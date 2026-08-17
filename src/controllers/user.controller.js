import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken"

const generateAccessAndRefreshTokens = async(userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()
        
        user.refreshToken = refreshToken
        await user.save({validateBeforeSave: false})

        return {accessToken, refreshToken}

    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating access and refresh token")
    }
}

const registerUser = asyncHandler(async (req, res) =>{
    // console.log("HIT registerUser")
    // receive details
    // validation of details - not empty
    // check if user already exists : username or email
    // check for images, avatar image
    // upload to cloundinary, avatar image
    // create user in database
    // remove password and refresh token from db
    // check for user creation
    // return res

    const {fullName, username, email, password} = req.body;

    if (
        [fullName, username, email, password].some((field) => 
         field?.trim() === "" )
    ) {
        throw new ApiError(400, "All fields are required")
    }

    const existedUser = await User.findOne({
        $or: [{username}, {email}]
    })

    if(existedUser){
        throw new ApiError(409, "User with the given username or email already exists")
    }

    console.log(req.files);
    const avatarLocalPath = req.files?.avatar[0]?.path

    let coverImageLocalPath;

    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path
    }

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){
        throw new ApiError(400, "Avatar file is required")
    }

    const user = await User.create({
        fullName, 
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        username : username.toLowerCase(),
        password,
        email: email.toLowerCase(),
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )
    
    if(!createdUser){
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser,"User register successfully ")
    )
})

const loginUser = asyncHandler(async(req, res) => {
    // take data
    // username or email
    // find the user
    // check password
    // generate refresh and access token
    // cookie

    const {username, email, password} = req.body;

    if(!username && !email){
        return new ApiError(400, "Username or email is required")
    }

    const user = await User.findOne({
        $or: [{username}, {email}]
    })

    if(!user){
        return new ApiError(400, "User does not exist")
    }

    const isPasswordValid = await user.isPasswordCorrect(password);   
    
    if(!isPasswordValid){
        return new ApiError(401, "Invalid user credentials")
    }

    const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id);

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true,
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser, refreshToken, accessToken
            },
            "User logged In Successfully"
        )
    )
})

const logoutUser = asyncHandler(async(req, res) => {
    // refersh token database se remove krna
    User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    // refresh token cookie se remove krke bhejna
    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(
        new ApiResponse(200, {}, "User logged Out")
    )
})

const refreshAccessToken = asyncHandler(async(req, res) =>{
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
        throw new ApiError(401, "Unauthorized request")
    }

    try {
        const decodedRefreshToken = await jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_SECRET_TOKEN
        )

        const user = await User.findById(decodedRefreshToken?._id)

        if(!user){
            throw new ApiError(401, "Invalid refresh token")
        }

        if(incomingRefreshToken !== user.refreshToken){
            throw new ApiError(401, "Refresh token is expired or used")
        }

        const {accessToken, newRefreshToken} = await generateAccessAndRefreshTokens(user._id)

        const options = {
            httpOnly: true,
            secure: true
        }
        
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(200, {accessToken, refreshToken : newRefreshToken}, "Access token refreshed successfully")
        )

    } catch (error) {
        throw new ApiError(400, error?.message || "Invalid refresh token")
    }
})

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const {oldPassword, newPassword, confPassword} = req.body

    if(!(newPassword === confPassword)){
        throw new ApiError(400, "New password does not match with confirm password")
    }

    const isPasswordCorrect = await user.isPasswordCorrect(newPassword)

    if(!isPasswordCorrect){
        throw new ApiError(400, "Password is invalid")
    }

    const user = await User.findById(req.user?._id)

    if(!user){
        throw new ApiError(400, "Invalid details")
    }

    user.password = newPassword;
    await user.save({validateBeforeSave : false})

    return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"))
})

const getCurrentUser = asyncHandler(async(req, res) => {
    return res
    .status(200)
    .json(new ApiResponse(200, req.user, "Current user fetched successfully"))
})

const updateAccountDetails = asyncHandler(async(req, res) => {
    const {fullName, email} = req.body

    if(!fullName || !email){
        throw new ApiError(400, "All fields are required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName: fullName,
                email: email,
            }
        },
        {new: true}
    ).select("-password -refreshToken")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details changed suuccessfully"))
})

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path

    if(!avatarLocalPath){
        throw new ApiError(400, "Invalid avatar file")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);

    if(!avatar){
        throw new ApiError(400, "Error while uploading on cloudinary")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url,
            }
        },
        {
            new: true,
        }
    ).select("-password -refreshToken")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar changed successfully"))
})

const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path

    if(!coverImageLocalPath){
        throw new ApiError(400, "Invalid cover image file")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!coverImage){
        throw new ApiError(400, "Error while uploading on cloudinary")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: coverImage.url,
            }
        },
        {
            new: true,
        }
    ).select("-password -refreshToken")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Cover Image changed successfully"))
})

export {
    registerUser, 
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
}
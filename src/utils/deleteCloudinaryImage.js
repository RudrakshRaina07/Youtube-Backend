import { v2 as cloudinary } from "cloudinary";
import { ApiError } from "./ApiError";
import { ApiResponse } from "./ApiResponse";

const deleteImageOnCLoudinary = async(cloudinaryImagePath) => {
    try {
        const deletedImage = await cloudinary.uploader.destroy(cloudinaryImagePath);

        if(!deletedImage){
            throw new ApiError(400, "Error while deleting old image from cloudinary")
        }

        return res
        .status(200)
        .json(
            new ApiResponse(200, {}, "Old image deleted from cloudinary successfully")
        )
    } catch (error) {
        throw new ApiError(400, "Error while deleting old image from cloudinary", error)
    }
}

export default deleteImageOnCLoudinary
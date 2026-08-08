import express from "express"
import cors from "cors"
import cookieParser from 'cookie-parser'

const app = express();

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}))
app.use(express.json({
    limit:"16kb"
}))
app.use(express.urlencoded({
    limit: "16kb"
}))
app.use(express.static("public"))
app.use(cookieParser())

// IMPORTING ROUTERS
import userRouter from "./routes/user.routes.js";

// routers declaration
app.use("/api/v1/users", userRouter)

export { app }
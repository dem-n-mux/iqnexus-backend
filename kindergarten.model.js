import mongoose from "mongoose";
const Schema = mongoose.Schema;

const KindergartenStudentSchema = new Schema(
    {
        rollNo: {
            type: String,
            required: true,
            trim: true,
            unique: true,
        },
        Duplicates: {
            type: Boolean,
            default: false,
        },
        schoolCode: {
            type: Number,
            required: true,
        },
        class: {
            type: String,
            required: true,
            trim: true,
            enum: ["KG"],
        },
        section: {
            type: String,
            required: true,
            trim: true,
            enum: ["LKG", "UKG", "PG"],
        },
        studentName: {
            type: String,
            required: true,
            trim: true,
        },
        motherName: {
            type: String,
            trim: true,
            default: "",
        },
        fatherName: {
            type: String,
            trim: true,
            default: "",
        },
        dob: {
            type: String,
            trim: true,
            default: "",
        },
        mobNo: {
            type: String,
            trim: true,
            default: "",
        },
        IQKG: {
            type: String,
            trim: true,
            default: "0",
        },
        city: {
            type: String,
            trim: true,
            default: "",
        },
    },
    { timestamps: true }
);

// Register the model
export const KINDERGARTEN_STUDENT = mongoose.model(
    "kindergarten_student_data",
    KindergartenStudentSchema
);
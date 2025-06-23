import {answersModel} from "../models/answersModel.js";

export const uploadAnswers = async (req, res) => {
    try {
        const { examLevel, subject, class: className, questions } = req.body;

        if (!examLevel || !subject || !className || !questions) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        const newAnswers = new answersModel({
            examLevel,
            subject,
            class: className,
            questions,
        });

        await newAnswers.save();

        res.status(200).json({ message: "Answers uploaded successfully" });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

export const getAnswers = async (req, res) => {
    try {
     

        if (!examLevel || !subject || !className) {
            return res.status(400).json({ message: "Missing required query parameters" });
        }

        const answers = await answersModel.find({ });

        if (!answers) {
            return res.status(404).json({ message: "Answers List not available" });
        }

        res.status(200).json(answers);
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};


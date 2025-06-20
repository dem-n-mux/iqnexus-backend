import AWS from "aws-sdk";
import fs from "fs";
import { StudyMaterial } from "../services/studyMaterialService.js";

AWS.config.update({
  accessKeyId: process.env.AWS_KEY,
  secretAccessKey: process.env.AWS_SECRET,
  region: process.env.AWS_REGION,
});
const s3 = new AWS.S3();
export const addStudentStudyMaterial = async (req, res) => {
  console.log("AWS Key:", process.env.AWS_KEY);
  console.log("AWS Secret:", process.env.AWS_SECRET);
  console.log("AWS Region:", process.env.AWS_REGION);
  const { name, age, className, subject, fee } = req.body;

  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const fileContent = fs.readFileSync(req.file.path);

  const params = {
    Bucket: "epocho",
    Key: `pdfs/${Date.now()}_${req.file.originalname}`,
    Body: fileContent,
    ContentType: "application/pdf",
  };

  try {
    const result = await s3.upload(params).promise();
    fs.unlinkSync(req.file.path); // optional: cleanup temp file
    const resultMongo = await StudyMaterial.create({
      category: name,
      class: className,
      examId: subject,
      cost: fee,
      pdfLink: result.Location,
    });
    resultMongo.save();
    console.log("File uploaded successfully. Location:", result.Location);

    console.log(result.Location);
    res.json({
      message: "Upload successful",
      url: result.Location,
      name,
      age,
    });
  } catch (err) {
    console.error("S3 Upload Error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
};

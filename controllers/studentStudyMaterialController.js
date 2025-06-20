import AWS from 'aws-sdk';
import fs from 'fs';

AWS.config.update({
  accessKeyId: process.env.AWS_key ,
  secretAccessKey: process.env.AWS_SECRET,
  region: process.env.AWS_REGION,
});
const s3 = new AWS.S3();
export const addStudentStudyMaterial = async (req, res) => {

const { name, age ,className, subject ,fee   } = req.body;

  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const fileContent = fs.readFileSync(req.file.path);

  const params = {
    Bucket: "epocho",
    Key: `pdfs/${Date.now()}_${req.file.originalname}`,
    Body: fileContent,
    ContentType: "application/pdf",
    ACL: "public-read",
  };

  try {
    const result = await s3.upload(params).promise();
    fs.unlinkSync(req.file.path); // optional: cleanup temp file
    const resultMongo = await STUDENT_LATEST.create({
        category: name,
        class: className,
        examId: subject,
        cost: fee,
        pdfLink : result.Location,

});

console.log(result.Location)
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
}


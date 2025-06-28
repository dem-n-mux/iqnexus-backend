import mongoose from "mongoose";
import { STUDENT_LATEST } from "../models/newStudentModel.model.js";
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB Connected");
  })
  .catch((err) => console.error("MongoDB Connection Error:", err));

const studyMaterialSchema = new mongoose.Schema({
  id: Number,
  class: Number,
  category: String,
  examId: String,
  cost: Number,
  strikeThroughCost: Number,
  isAvailableForFree: String,
  pdfLink: String,
});

const StudyMaterial = mongoose.model(
  "StudyMaterial",
  studyMaterialSchema,
  "study-material"
);

async function fetchStudyMaterial(studentClass, studentName, mobNo) {
  const studyMaterialArray=[]
  if (!studentClass) {
    console.error("🚨 Error: Class information not found for the student");
    throw new Error("Class information not found for the student");
  }
  try {
    const materials = await StudyMaterial.find({ class: studentClass });
    
    if (materials.length === 0) {
      console.warn("⚠️ No study materials found for class:", studentClass);
      throw new Error("No study materials found for this class");
    }
    else {
      const studentData= await STUDENT_LATEST.findOne({
        studentName:studentName,
        mobNo: mobNo
      })
      if(studentData.IAOL1Book === "1") {
    const material =StudyMaterial.find({
      examId: "IAOL1Book",
    })
    studyMaterialArray.push(material);

      }
      if(studentData.ITSTL1Book === "1") {
    const material = await StudyMaterial.find({
      examId: "ITSTL1Book",
    });
    studyMaterialArray.push(material);
      }
            if(studentData.IMOL1Book === "1") {
    const material = await StudyMaterial.find({
      examId: "IMOL1Book",
    });
    studyMaterialArray.push(material);
      }
            if(studentData.IENGOL1Book === "1") {
    const material = await StudyMaterial.find({
      examId: "IENGOL1Book",
    });
    studyMaterialArray.push(material);
      }
            if(studentData.IGKOL1Book === "1") {
    const material = await StudyMaterial.find({
      examId: "IGKOL1Book",
    });
    studyMaterialArray.push(material);
      }


    }

    return { success: true, data: studyMaterialArray };
  } catch (error) {
    console.error("❌ Error fetching study material:", error);
    throw new Error("Internal server error");
  }
}

export { fetchStudyMaterial, mongoose, StudyMaterial };
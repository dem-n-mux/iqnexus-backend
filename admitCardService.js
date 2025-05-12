// import nodeHtmlToImage from "node-html-to-image";
// import fs from "fs";
// import path from "path";
// import mongoose from "mongoose";
// import { MongoClient, GridFSBucket } from "mongodb";
// import { fileURLToPath } from 'url';
// import { dirname } from 'path';
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);

// const mongoURI = process.env.MONGO_URI;
// const dataBaseName = process.env.DATABASE_NAME;

// async function databaseConnection() {
//   const client = new MongoClient(mongoURI);
//   await client.connect();
//   return { conn: client.db(dataBaseName), status: "success" };
// }

// async function generateAdmitCard(info, level, session) {
//   try {
//     const outputDir = "./outputs";
//     clearOutputDirectory(outputDir);
//     const outputPath = `./outputs/admitCard_${info["Student's Name"]}-${level}.png`;

//     const templatePath = path.join(__dirname, "designs", "admitCard.html");
//     if (!fs.existsSync(templatePath)) {
//       throw new Error(`Template file not found: ${templatePath}`);
//     }

//     const logoPath = path.join(__dirname, "assets", "logo.png");

//     const logoBase64 = fs.readFileSync(logoPath, { encoding: "base64" });
//     const logoSrc = `data:image/png;base64,${logoBase64}`;
//     const suffix = level.toLowerCase() === "basic" ? "Basic Level" : "Advance Level";
//     const subjectLevel = level.toLowerCase() === "basic" ? "Basic" : "Advance";
//     const IAOL = info[`IAOL ${subjectLevel}`] === "1";
//     const ITSTL = info[`ITSTL ${subjectLevel}`] === "1";
//     const IMOL = info[`IMOL ${subjectLevel}`] === "1";
//     const IGKOL = info[`IGKOL ${subjectLevel}`] === "1";
//     const IENGOL = info[`IGENOL ${subjectLevel}`] === "1";

//     await nodeHtmlToImage({
//       output: outputPath,
//       html: fs.readFileSync(templatePath, "utf8"),
//       content: {
//         logoSrc,
//         name: info["Student's Name"],
//         father: info["Father's Name"],
//         mother: info["Mother's Name"],
//         class: info["Class"],
//         section: info["Section"],
//         rollNo: info["Roll No"],
//         school: info["School"],
//         schoolCode: info["School Code"],
//         mobile: info["Mob No"],
//         city: info["City"],
//         state: info["State"],
//         country: info["Country"],
//         examCenter: info["Exam Centre"],
//         level: suffix,
//         session: session,
//         qrUrl:
//           "https://api.qrserver.com/v1/create-qr-code/?data=https://wa.me/919999999999&size=100x100",
//         IAOL,
//         ITSTL,
//         IMOL,
//         IGKOL,
//         IENGOL,
//       },
//       puppeteerArgs: {
//         args: ["--no-sandbox", "--disable-setuid-sandbox"],
//         defaultViewport: {
//           width: 900,
//           height: 1100,
//         },
//       },
//       type: "png",
//       quality: 100,
//     });

//     return { success: true, path: outputPath };
//   } catch (error) {
//     console.error("Error generating admit card:", error);
//     return { success: false, error: error.message };
//   }
// }

// function clearOutputDirectory(outputDir) {
//   if (fs.existsSync(outputDir)) {
//     fs.readdirSync(outputDir).forEach((file) => {
//       const filePath = path.join(outputDir, file);
//       fs.unlinkSync(filePath);
//     });
//   } else {
//     fs.mkdirSync(outputDir, { recursive: true });
//   }
// }

// async function dbConnection() {
//   try {
//     const conn = await mongoose.createConnection(process.env.MONGO_URI, {
//       useNewUrlParser: true,
//       useUnifiedTopology: true,
//     });

//     return new Promise((resolve, reject) => {
//       conn.once("open", async () => {
//         const collections = await conn.db.listCollections().toArray();
//         const collectionNames = collections.map((col) => col.name);

//         if (
//           collectionNames.includes("admitCards.files") &&
//           collectionNames.includes("admitCards.chunks")
//         ) {
//         } else {
//           new GridFSBucket(conn.db, { bucketName: "admitCards" });
//         }

//         resolve({ status: "success", conn });
//       });

//       conn.on("error", (err) => {
//         console.error("❌ MongoDB Connection Error:", err);
//         reject({ status: "failed", error: err.message });
//       });
//     });
//   } catch (error) {
//     console.error("❌ Database connection error:", error);
//     return { status: "failed", error: error.message };
//   }
// }

// async function uploadAdmitCard(studentData, res, level) {
//   try {
//     const admitCardPath = `./outputs/admitCard_${studentData["Student's Name"]}-${level}.png`;
//     if (!fs.existsSync(admitCardPath)) {
//       throw new Error("Admit card file does not exist.");
//     }

//     const dbResponse = await dbConnection();
//     if (dbResponse.status !== "success") {
//       return res.status(500).json({ error: "Database connection failed" });
//     }

//     const db = dbResponse.conn.db;
//     const gfs = new GridFSBucket(db, { bucketName: "admitCards" });

//     const existingFiles = await db
//       .collection("admitCards.files")
//       .findOne({ filename: `admitCard_${studentData["Student's Name"]}-${level}.png` });

//     if (existingFiles) {
//       return res.status(200).json({
//         message: "Admit card already exists in storage",
//         fileId: existingFiles._id,
//       });
//     }

//     const fileStream = fs.createReadStream(admitCardPath);

//     const writeStream = gfs.openUploadStream(
//       `admitCard_${studentData["Student's Name"]}-${level}.png`,
//       {
//         contentType: "image/png",
//         metadata: {
//           studentId: studentData["_id"],
//           mobNo: studentData["Mob No"],
//         },
//       }
//     );

//     fileStream.pipe(writeStream);

//     writeStream.on("finish", () => {
//       fs.unlinkSync(admitCardPath);

//       if (!res.headersSent) {
//         return res.status(200).json({
//           message: "Admit card stored successfully",
//           fileId: writeStream.id,
//         });
//       }
//     });

//     writeStream.on("error", (err) => {
//       if (!res.headersSent) {
//         res.status(500).json({ error: "Failed to upload admit card" });
//       }
//     });
//   } catch (error) {
//     console.error("❌ Error processing admit card:", error);
//     if (!res.headersSent) {
//       res.status(500).json({ error: error.message });
//     }
//   }
// }

// async function fetchAdmitCardFromDB(studentName, res, level) {
//   try {
//     const dbResponse = await databaseConnection();
//     if (dbResponse.status !== "success") {
//       return res.status(500).json({ error: "Database connection failed" });
//     }

//     const db = dbResponse.conn;
//     const gfs = new GridFSBucket(db, { bucketName: "admitCards" });
//     const fileExists = await db
//       .collection("admitCards.files")
//       .findOne({ filename: `admitCard_${studentName}-${level}.png` });

//     if (!fileExists) {
//       return res.status(404).json({ error: "Admit card not found" });
//     }

//     res.setHeader("Content-Type", "image/png");
//     const readStream = gfs.openDownloadStream(fileExists._id);
//     readStream.pipe(res);
//   } catch (error) {
//     console.error("❌ Error fetching admit card:", error);
//     res.status(500).json({ error: "Failed to fetch admit card" });
//   }
// }

// export {
//   generateAdmitCard,
//   dbConnection,
//   uploadAdmitCard,
//   fetchAdmitCardFromDB,
// };

//admitcradService.js
import nodeHtmlToImage from "node-html-to-image";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { MongoClient, GridFSBucket } from "mongodb";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mongoURI = process.env.MONGO_URI;
const dataBaseName = process.env.DATABASE_NAME;

async function databaseConnection() {
  const client = new MongoClient(mongoURI);
  await client.connect();
  return { conn: client.db(dataBaseName), status: "success" };
}

async function generateAdmitCard(info, level, session) {
  try {
    const outputDir = "./outputs";
    clearOutputDirectory(outputDir);
    const outputPath = `./outputs/admitCard_${info["Student's Name"]}-${level}-${session}.png`;

    const templatePath = path.join(__dirname, "designs", "admitCard.html");
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template file not found: ${templatePath}`);
    }

    const logoPath = path.join(__dirname, "assets", "logo.png");

    const logoBase64 = fs.readFileSync(logoPath, { encoding: "base64" });
    const logoSrc = `data:image/png;base64,${logoBase64}`; 
    const suffix = level.toLowerCase() === "basic" ? "Basic Level" : "Advance Level";
    const  subjectLevel = level.toLowerCase() === "basic" ? "Basic" : "Advance";
    const IAOL = info[`IAOL ${subjectLevel}`] === "1";
    const ITSTL = info[`ITSTL ${subjectLevel}`] === "1";
    const IMOL = info[`IMOL ${subjectLevel}`] === "1";
    const IGKOL = info[`IGKOL ${subjectLevel}`] === "1";
    const IENGOL = info[`IGENOL ${subjectLevel}`] === "1";

    await nodeHtmlToImage({
      output: outputPath,
      html: fs.readFileSync(templatePath, "utf8"),
      content: {
        logoSrc,
        name: info["Student's Name"],
        father: info["Father's Name"],
        mother: info["Mother's Name"],
        class: info["Class"],
        section: info["Section"],
        rollNo: info["Roll No"],
        school: info["School"],
        schoolCode: info["School Code"],
        mobile: info["Mob No"],
        city: info["City"],
        state: info["State"],
        country: info["Country"],
        examCenter: info["Exam Centre"],
        level: suffix,
        session: session,
        classTeacher: info["Incharge"],
        principal: info["Principal"],
        qrUrl:
          "https://api.qrserver.com/v1/create-qr-code/?data=https://wa.me/919999999999&size=100x100",
          IAOL,
          ITSTL,
          IMOL,
          IGKOL,
          IENGOL,  
      },
      puppeteerArgs: {
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
        defaultViewport: {
          width: 900,
          height: 1100,
        },
      },
      type: "png",
      quality: 100,
    });

    return { success: true, path: outputPath };
  } catch (error) {
    console.error("Error generating admit card:", error);
    return { success: false, error: error.message };
  }
}

function clearOutputDirectory(outputDir) {
  if (fs.existsSync(outputDir)) {
    fs.readdirSync(outputDir).forEach((file) => {
      const filePath = path.join(outputDir, file);
      fs.unlinkSync(filePath);
    });
  } else {
    fs.mkdirSync(outputDir, { recursive: true });
  }
}

async function dbConnection() {
  try {
    const conn = await mongoose.createConnection(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    return new Promise((resolve, reject) => {
      conn.once("open", async () => {
        const collections = await conn.db.listCollections().toArray();
        const collectionNames = collections.map((col) => col.name);

        if (
          collectionNames.includes("admitCards.files") &&
          collectionNames.includes("admitCards.chunks")
        ) {
        } else {
          new GridFSBucket(conn.db, { bucketName: "admitCards" });
        }

        resolve({ status: "success", conn });
      });

      conn.on("error", (err) => {
        console.error("❌ MongoDB Connection Error:", err);
        reject({ status: "failed", error: err.message });
      });
    });
  } catch (error) {
    console.error("❌ Database connection error:", error);
    return { status: "failed", error: error.message };
  }
}

async function uploadAdmitCard(studentData, res, level, session) {
  try {
    const admitCardPath = `./outputs/admitCard_${studentData["Student's Name"]}-${level}-${session}.png`;
    if (!fs.existsSync(admitCardPath)) {
      throw new Error("Admit card file does not exist.");
    }

    const dbResponse = await dbConnection();
    if (dbResponse.status !== "success") {
      return res.status(500).json({ error: "Database connection failed" });
    }

    const db = dbResponse.conn.db;
    const gfs = new GridFSBucket(db, { bucketName: "admitCards" });

    const existingFiles = await db
      .collection("admitCards.files")
      .findOne({ filename: `admitCard_${studentData["Student's Name"]}-${level}-${session}.png` });

    if (existingFiles) {
      return res.status(200).json({
        message: "Admit card already exists in storage",
        fileId: existingFiles._id,
      });
    }

    const fileStream = fs.createReadStream(admitCardPath);

    const writeStream = gfs.openUploadStream(
      `admitCard_${studentData["Student's Name"]}-${level}-${session}.png`,
      {
        contentType: "image/png",
        metadata: {
          studentId: studentData["_id"],
          mobNo: studentData["Mob No"],
        },
      }
    );

    fileStream.pipe(writeStream);

    writeStream.on("finish", () => {
      fs.unlinkSync(admitCardPath);

      if (!res.headersSent) {
        return res.status(200).json({
          message: "Admit card stored successfully",
          fileId: writeStream.id,
        });
      }
    });

    writeStream.on("error", (err) => {
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to upload admit card" });
      }
    });
  } catch (error) {
    console.error("❌ Error processing admit card:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
}

async function fetchAdmitCardFromDB(studentName, res, level, session) {
  try {
    const dbResponse = await databaseConnection();
    if (dbResponse.status !== "success") {
      return res.status(500).json({ error: "Database connection failed" });
    }

    const db = dbResponse.conn;
    const gfs = new GridFSBucket(db, { bucketName: "admitCards" });
    const fileExists = await db
      .collection("admitCards.files")
      .findOne({ filename: `admitCard_${studentName}-${level}-${session}.png` });

    if (!fileExists) {
      return res.status(404).json({ error: "Admit card not found" });
    }

    res.setHeader("Content-Type", "image/png");
    const readStream = gfs.openDownloadStream(fileExists._id);
    readStream.pipe(res);
  } catch (error) {
    console.error("❌ Error fetching admit card:", error);
    res.status(500).json({ error: "Failed to fetch admit card" });
  }
}

export {
  generateAdmitCard,
  dbConnection,
  uploadAdmitCard,
  fetchAdmitCardFromDB,
};
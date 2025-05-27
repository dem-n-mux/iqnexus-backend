import { KINDERGARTEN_STUDENT } from "./kindergarten.model.js"
import fs from "fs";
import { parse } from "csv-parse";
import mongoose from "mongoose";
import { promises as fsPromises } from "fs";

export async function excelToMongoDbForKindergarten(filePath) {
    try {
        const renameFields = {
            "Student Name": "studentName",
            "Roll No": "rollNo",
            "School Code": "schoolCode",
            Section: "section",
            "Mother Name": "motherName",
            "Father Name": "fatherName",
            DOB: "dob",
            "Mobile": "mobNo",
            City: "city",
            IQKG: "IQKG",
            Duplicates: "Duplicates",
            Class: "class",
        };

        const requiredColumns = ["studentName", "rollNo", "schoolCode", "section"];
        const optionalColumns = [
            "motherName",
            "fatherName",
            "dob",
            "mobNo",
            "city",
            "IQKG",
            "Duplicates",
            "class",
        ];
        const allColumns = [...requiredColumns, ...optionalColumns];

        const students = [];
        let headers = [];

        // Parse CSV file
        await new Promise((resolve, reject) => {
            fs.createReadStream(filePath)
                .pipe(
                    parse({
                        columns: (header) =>
                            header.map((h) => renameFields[h.trim()] || h.trim()),
                        trim: true,
                        skip_empty_lines: true,
                    })
                )
                .on("headers", (headerList) => {
                    headers = headerList;
                    console.log("CSV Headers:", headers); // Debug headers
                    const missingColumns = requiredColumns.filter(
                        (col) => !headers.includes(col)
                    );
                    if (missingColumns.length > 0) {
                        reject(
                            new Error(`Missing required columns: ${missingColumns.join(", ")}`)
                        );
                    }
                    const unexpectedColumns = headers.filter(
                        (col) => !allColumns.includes(col)
                    );
                    if (unexpectedColumns.length > 0) {
                        console.warn(
                            `Unexpected columns ignored: ${unexpectedColumns.join(", ")}`
                        );
                    }
                })
                .on("data", (row) => {
                    console.log("CSV Row:", row); // Debug row
                    students.push(row);
                })
                .on("end", resolve)
                .on("error", reject);
        });

        // Validate and transform student data
        const validSections = ["LKG", "UKG", "PG"];
        const invalidRecords = [];
        const processedStudents = students.map((student, index) => {
            const rowNum = index + 2;
            const errors = [];

            if (!student.studentName) {
                errors.push(`Row ${rowNum}: studentName is required`);
            }
            if (!student.rollNo) {
                errors.push(`Row ${rowNum}: rollNo is required`);
            }
            let schoolCode = null;
            if (student.schoolCode) {
                const parsedCode = parseInt(student.schoolCode);
                if (!isNaN(parsedCode)) {
                    schoolCode = parsedCode;
                } else {
                    errors.push(
                        `Row ${rowNum}: schoolCode must be a number, got "${student.schoolCode}"`
                    );
                }
            } else {
                errors.push(`Row ${rowNum}: schoolCode is required`);
            }
            if (!student.section || !validSections.includes(student.section)) {
                errors.push(`Row ${rowNum}: section must be LKG, UKG, or PG`);
            }
            if (student.class && student.class !== "KG") {
                errors.push(`Row ${rowNum}: class must be KG`);
            }
            if (
                student.IQKG &&
                !["0", "1", "yes", "no"].includes(String(student.IQKG).toLowerCase())
            ) {
                errors.push(`Row ${rowNum}: IQKG must be 0, 1, yes, or no`);
            }
            if (
                student.Duplicates &&
                !["true", "false", "0", "1"].includes(
                    String(student.Duplicates).toLowerCase()
                )
            ) {
                errors.push(`Row ${rowNum}: Duplicates must be true or false`);
            }

            if (errors.length > 0) {
                invalidRecords.push({
                    row: rowNum,
                    rollNo: student.rollNo || "unknown",
                    errors,
                });
            }

            return {
                rollNo: student.rollNo ? String(student.rollNo).trim() : "",
                schoolCode,
                class: "KG",
                section: student.section ? String(student.section).trim() : "",
                studentName: student.studentName ? String(student.studentName).trim() : "",
                motherName: student.motherName ? String(student.motherName).trim() : "",
                fatherName: student.fatherName ? String(student.fatherName).trim() : "",
                dob: student.dob ? String(student.dob).trim() : "",
                mobNo: student.mobNo ? String(student.mobNo).trim() : "",
                city: student.city ? String(student.city).trim() : "",
                IQKG: student.IQKG
                    ? String(student.IQKG).toLowerCase() === "yes" ||
                        String(student.IQKG) === "1"
                        ? "1"
                        : "0"
                    : "0",
                Duplicates: student.Duplicates
                    ? String(student.Duplicates).toLowerCase() === "true" ||
                    String(student.Duplicates) === "1"
                    : false,
            };
        });

        const validStudents = processedStudents.filter((student) => {
            return (
                student.rollNo &&
                student.schoolCode !== null &&
                student.studentName &&
                student.section
            );
        });

        if (invalidRecords.length > 0) {
            console.warn("Invalid kindergarten student records:", invalidRecords);
        }

        if (mongoose.connection.readyState !== 1) {
            throw new Error("MongoDB is not connected");
        }

        const rollNos = validStudents.map((s) => s.rollNo);
        const duplicateRollNos = rollNos.filter(
            (rollNo, index) => rollNos.indexOf(rollNo) !== index
        );
        if (duplicateRollNos.length > 0) {
            throw new Error(
                `Duplicate roll numbers found in CSV: ${[...new Set(duplicateRollNos)].join(
                    ", "
                )}`
            );
        }

        const existingStudents = await KINDERGARTEN_STUDENT.find({
            rollNo: { $in: rollNos },
        }).select("rollNo");
        const existingRollNos = existingStudents.map((s) => s.rollNo);
        if (existingRollNos.length > 0) {
            throw new Error(
                `Some roll numbers already exist in the database: ${existingRollNos.join(
                    ", "
                )}`
            );
        }

        let insertedCount = 0;
        if (validStudents.length > 0) {
            const insertedStudents = await KINDERGARTEN_STUDENT.insertMany(
                validStudents,
                { ordered: false }
            );
            insertedCount = insertedStudents.length;
            console.log(
                `Successfully inserted ${insertedCount} kindergarten students into MongoDB`
            );
        } else {
            console.log("No valid kindergarten student records to insert");
        }

        await fsPromises.unlink(filePath);

        return {
            success: true,
            message: `Inserted ${insertedCount} kindergarten students`,
            count: insertedCount,
            invalidRecords: invalidRecords.length > 0 ? invalidRecords : undefined,
        };
    } catch (error) {
        try {
            await fsPromises.unlink(filePath);
        } catch (unlinkError) {
            console.error("Error deleting file:", unlinkError);
        }
        console.error("Error processing kindergarten student CSV file:", error);
        throw new Error("Invalid data in CSV file", { cause: { invalidRecords } });
    }
}
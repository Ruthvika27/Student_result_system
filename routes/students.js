const express = require("express");
const router = express.Router();


const Student = require("../models/student");
const multer = require("multer");
const csv = require("csv-parser");
const fs = require("fs");
const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");

// Email config
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'ruthuu666@gmail.com',       // ← your Gmail
    pass: 'stqq etsj qyjg fgnf',          // ← app password (not your Gmail login)
  },
});

// Configure multer
const upload = multer({ dest: "uploads/" });

// Home - Redirect to dashboard
router.get("/", (req, res) => {
  res.redirect("/dashboard");
});

// Dashboard
router.get("/dashboard", async (req, res) => {
    
  const students = await Student.find();

  // Pass/Fail count
  const passCount = students.filter(s => s.result === "Pass").length;
  const failCount = students.length - passCount;

  // Total marks per student
  const names = students.map(s => s.name);
  const totals = students.map(s => s.total);

  // Subject-wise average
  const mathAvg = (
    students.reduce((acc, s) => acc + s.marks.math, 0) / students.length
  ).toFixed(2);
  const scienceAvg = (
    students.reduce((acc, s) => acc + s.marks.science, 0) / students.length
  ).toFixed(2);
  const englishAvg = (
    students.reduce((acc, s) => acc + s.marks.english, 0) / students.length
  ).toFixed(2);

  // Topper
  const topper = students.reduce((max, s) => (s.total > max.total ? s : max), students[0]);


    res.render("dashboard", {
    students,
    passCount,
    failCount,
    names: JSON.stringify(names),
    totals: JSON.stringify(totals),
    mathAvg,
    scienceAvg,
    englishAvg,
    topper // <-- don't forget to send this!
    });

});


// Add Student Form
router.get("/add", (req, res) => {
  res.render("add");
});

// Other routes will come here (edit, delete, CSV, PDF, etc.)

module.exports = router;

// POST: Add Student
router.post("/add", async (req, res) => {
  try {
    //console.log("💬 Form Data:", req.body); // See what you're receiving

    // Destructure safely
    const name = req.body.name;
    const rollNo = req.body.rollNo;
    const email = req.body.email;
    const math = Number(req.body.math);
    const science = Number(req.body.science);
    const english = Number(req.body.english);
    const total = math + science + english;
    let grade="F";
    if (total >= 270) grade = "A";
    else if (total >= 240) grade = "B";
    else if (total >= 210) grade = "C";
    else if (total >= 180) grade = "D";
    else if(total>=105) grade = "P";

    
    const result = (math >= 35 && science >= 35 && english >= 35) ? "Pass" : "Fail";

    const newStudent = new Student({
      name,
      rollNo,
      email,
      marks: {
        math,
        science,
        english,
      },
      total,
      grade,
      result,
    });

    await newStudent.save();

        // Generate PDF in memory
    const doc = new PDFDocument();
    let buffers = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', async () => {
    const pdfData = Buffer.concat(buffers);

    // Send email
    const mailOptions = {
        from: 'your-email@gmail.com',
        to: email,
        subject: `Your Result Report, ${name}`,
        text: 'Attached is your result report card.',
        attachments: [
        {
            filename: `${name}_ReportCard.pdf`,
            content: pdfData,
        },
        ],
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log("📧 Email sent to", email);
    } catch (err) {
        console.error("❌ Email sending failed:", err);
    }
    });

    // Write PDF content
    doc.fontSize(20).text("Student Report Card", { align: "center" });
    doc.moveDown();
    doc.fontSize(14).text(`Name: ${name}`);
    doc.text(`Email: ${email}`);
    doc.text(`Roll No: ${rollNo}`);
    doc.text(`Result: ${result}`);
    doc.moveDown();
    doc.text(`Marks:`);
    doc.text(`Math: ${math}`);
    doc.text(`Science: ${science}`);
    doc.text(`English: ${english}`);
    doc.moveDown();
    doc.text(`Total: ${total}`);
    doc.end();

    res.redirect("/dashboard");
  } catch (err) {
    console.error("❌ Error in /add route:", err);
    res.status(500).send("Error adding student");
  }
});



// GET: Edit Student Form
router.get("/edit/:id", async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    res.render("edit", { student });
  } catch (err) {
    console.error("Error fetching student:", err);
    res.redirect("/dashboard");
  }
});


// POST: Update Student
router.post("/edit/:id", async (req, res) => {
  const { name, rollNo, email, math, science, english } = req.body;

  const mathNum = Number(math);
  const scienceNum = Number(science);
  const englishNum = Number(english);
  const total = mathNum + scienceNum + englishNum;

  // Grade logic
  let grade="F";
    if (total >= 270) grade = "A";
    else if (total >= 240) grade = "B";
    else if (total >= 210) grade = "C";
    else if (total >= 180) grade = "D";
    else if(total>=105) grade = "P";

  // Pass/Fail logic
  const result = (mathNum >= 35 && scienceNum >= 35 && englishNum >= 35) ? "Pass" : "Fail";

  // Update in DB
  await Student.findByIdAndUpdate(req.params.id, {
    name,
    rollNo,
    email,
    marks: {
      math: mathNum,
      science: scienceNum,
      english: englishNum
    },
    total,
    grade,
    result
  });

  res.redirect("/dashboard");
});


// DELETE: Remove a student
router.get("/delete/:id", async (req, res) => {
  try {
    await Student.findByIdAndDelete(req.params.id);
    res.redirect("/dashboard");
  } catch (err) {
    console.error("Delete failed:", err);
    res.redirect("/dashboard");
  }
});



router.get("/student/:id/pdf", async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).send("Student not found");

    const doc = new PDFDocument();
    const filename = `${student.name}_ReportCard.pdf`;

    res.setHeader("Content-disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-type", "application/pdf");

    doc.pipe(res);

    // Title
    doc.fontSize(20).text("Student Report Card", { align: "center" });
    doc.moveDown();

    // Basic Info
    doc.fontSize(14).text(`Name: ${student.name}`);
    doc.text(`Email: ${student.email}`);
    doc.text(`Roll No: ${student.rollNo}`);
    doc.moveDown();

    // Marks Table Header
    doc.fontSize(16).text("Marks", { underline: true });
    doc.moveDown(0.5);

    // Table
    doc.fontSize(12);
    doc.text(`Math       : ${student.marks.math}`);
    doc.text(`Science    : ${student.marks.science}`);
    doc.text(`English    : ${student.marks.english}`);
    doc.moveDown();

    // Total + Result
    doc.fontSize(14).text(`Total Marks: ${student.total}`);
    doc.text(`Result: ${student.result}`);

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).send("Error generating PDF");
  }
});

router.post("/upload-csv", upload.single("csvfile"), async (req, res) => {
  const results = [];

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on("data", (data) => {
      results.push(data);
    })
    .on("end", async () => {
      try {
        for (let row of results) {
          const math = Number(row.math);
          const science = Number(row.science);
          const english = Number(row.english);
          const total = math + science + english;

          let grade="F";
          if (total >= 270) grade = "A";
          else if (total >= 240) grade = "B";
          else if (total >= 210) grade = "C";
          else if (total >= 180) grade = "D";
          else if(total>=105) grade = "P";

          
          const result = (math >= 35 && science >= 35 && english >= 35) ? "Pass" : "Fail";

          const newStudent = new Student({
            name: row.name,
            rollNo: row.rollNo,
            email: row.email,
            marks: {
              math,
              science,
              english,
            },
            total,
            grade,
            result,
          });

          await newStudent.save();
        }

        fs.unlinkSync(req.file.path); // delete temp file
        res.redirect("/dashboard");
      } catch (err) {
        console.error("CSV upload error:", err);
        res.status(500).send("Error uploading CSV");
      }
    });
});

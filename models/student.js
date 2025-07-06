const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema({
  name: String,
  rollNo: {
  type: String,
  required: true
  },
  marks: {
    math: Number,
    science: Number,
    english: Number
  },
  total: Number,
  grade: String,
  result: String,
  email: String // For sending result
});

module.exports = mongoose.model("Student", studentSchema);

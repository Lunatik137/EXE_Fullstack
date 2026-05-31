import mongoose from "mongoose";

const doctorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    title: { type: String, required: true }, // Bác Sĩ, ThS.BS, BS.CKI, ...
    specialty: { type: String, required: true }, // Khoa Nội Tiết, ...
    image: { type: String, required: true }, // filename in uploads/doctors/
    bio: { type: String, default: "" }, // short description
    detail: { type: String, default: "" }, // full HTML/text detail
    positions: [{ type: String }], // Chức vụ
    education: [{ type: String }], // Học vị
    experience: [{ type: String }], // Kinh nghiệm
    expertise: [{ type: String }], // Chuyên môn
    workplaces: [{ type: String }], // Nơi công tác
    research: [{ type: String }], // Nghiên cứu khoa học
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const doctorModel =
  mongoose.models.doctor || mongoose.model("doctor", doctorSchema);

export default doctorModel;

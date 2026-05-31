import doctorModel from "../models/doctorModel.js";

const getAllDoctors = async (req, res) => {
  try {
    const doctors = await doctorModel
      .find({ isActive: true })
      .sort({ order: 1, createdAt: 1 });
    res.json({ success: true, doctors });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error fetching doctors" });
  }
};

const getDoctorById = async (req, res) => {
  try {
    const { id } = req.params;
    const doctor = await doctorModel.findById(id);
    if (!doctor) {
      return res.json({ success: false, message: "Doctor not found" });
    }
    res.json({ success: true, doctor });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error fetching doctor" });
  }
};

export { getAllDoctors, getDoctorById };

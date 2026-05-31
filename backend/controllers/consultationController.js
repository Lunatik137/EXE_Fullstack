import consultationModel from "../models/consultationModel.js";
import doctorModel from "../models/doctorModel.js";
import nodemailer from "nodemailer";

const createTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

const bookConsultation = async (req, res) => {
  try {
    const { doctorId, name, email, phone, preferredDate, preferredTime, note } =
      req.body;

    if (!doctorId || !name || !email || !phone || !preferredDate || !preferredTime) {
      return res.json({ success: false, message: "Vui lòng điền đầy đủ thông tin" });
    }

    const doctor = await doctorModel.findById(doctorId);
    if (!doctor) {
      return res.json({ success: false, message: "Không tìm thấy bác sĩ" });
    }

    const consultation = await consultationModel.create({
      userId: req.userId || null,
      doctorId,
      name,
      email,
      phone,
      preferredDate,
      preferredTime,
      note: note || "",
    });

    // Send confirmation email
    try {
      const transporter = createTransporter();
      await transporter.sendMail({
        from: `"GreenPath Health" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Xác nhận đặt lịch tư vấn chuyên gia – GreenPath",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9fafb; padding: 32px;">
            <div style="background: white; border-radius: 16px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
              <div style="text-align:center; margin-bottom: 24px;">
                <span style="font-size: 32px;">🌿</span>
                <h2 style="color: #10b981; margin: 8px 0 0;">GreenPath</h2>
              </div>
              <h3 style="color: #1f2937; margin-bottom: 8px;">Xin chào ${name},</h3>
              <p style="color: #4b5563; line-height: 1.6;">
                Chúng tôi đã <strong>ghi nhận yêu cầu đặt lịch tư vấn</strong> của bạn. 
                Đội ngũ GreenPath sẽ liên hệ với bạn trong thời gian sớm nhất để xác nhận lịch hẹn.
              </p>
              
              <div style="background: #ecfdf5; border-radius: 12px; padding: 20px; margin: 24px 0;">
                <h4 style="color: #065f46; margin: 0 0 12px;">📋 Thông tin đặt lịch</h4>
                <table style="width:100%; border-collapse: collapse;">
                  <tr><td style="color:#6b7280; padding: 4px 0; width:40%;">Bác sĩ tư vấn:</td><td style="color:#1f2937; font-weight:600;">${doctor.title} ${doctor.name}</td></tr>
                  <tr><td style="color:#6b7280; padding: 4px 0;">Chuyên khoa:</td><td style="color:#1f2937;">${doctor.specialty}</td></tr>
                  <tr><td style="color:#6b7280; padding: 4px 0;">Ngày mong muốn:</td><td style="color:#1f2937;">${preferredDate}</td></tr>
                  <tr><td style="color:#6b7280; padding: 4px 0;">Khung giờ:</td><td style="color:#1f2937;">${preferredTime}</td></tr>
                  <tr><td style="color:#6b7280; padding: 4px 0;">Số điện thoại:</td><td style="color:#1f2937;">${phone}</td></tr>
                  ${note ? `<tr><td style="color:#6b7280; padding: 4px 0;">Ghi chú:</td><td style="color:#1f2937;">${note}</td></tr>` : ""}
                </table>
              </div>

              <p style="color: #4b5563; line-height: 1.6;">
                Nếu bạn cần thay đổi hoặc hủy lịch hẹn, vui lòng liên hệ với chúng tôi qua email này.
              </p>

              <div style="border-top: 1px solid #e5e7eb; margin-top: 24px; padding-top: 16px; text-align: center;">
                <p style="color: #9ca3af; font-size: 13px; margin: 0;">© 2026 GreenPath Health · Chăm sóc sức khỏe toàn diện</p>
              </div>
            </div>
          </div>
        `,
      });
    } catch (emailError) {
      console.error("Email send error:", emailError);
      // Don't fail the request if email fails
    }

    res.json({
      success: true,
      message: "Đặt lịch thành công! Email xác nhận đã được gửi.",
      consultation,
    });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Không thể đặt lịch. Vui lòng thử lại." });
  }
};

const getMyBookingForDoctor = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const userId = req.userId;

    if (!userId) {
      return res.json({ success: false, message: "Chưa đăng nhập" });
    }

    const booking = await consultationModel
      .findOne({ userId, doctorId, status: { $ne: "cancelled" } })
      .sort({ createdAt: -1 });

    if (!booking) {
      return res.json({ success: true, booking: null });
    }

    // Check if the booking date is still today or future
    const bookingDate = new Date(booking.preferredDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    bookingDate.setHours(0, 0, 0, 0);

    if (bookingDate < today) {
      return res.json({ success: true, booking: null });
    }

    res.json({ success: true, booking });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Lỗi khi tải thông tin đặt lịch" });
  }
};

export { bookConsultation, getMyBookingForDoctor };

import mongoose from "mongoose";
import "dotenv/config";
import { connectDB } from "../config/db.js";
import doctorModel from "../models/doctorModel.js";

const doctors = [
  {
    name: "Hà Thị Mỹ Hạnh",
    title: "BS",
    specialty: "Khoa Nội Tiết",
    image: "1.png",
    bio: "6 năm kinh nghiệm về Nội tiết, đái tháo đường. Chuyên viên tư vấn di truyền tại Genetica, chuyên về nguy cơ sức khoẻ.",
    positions: [
      "2013 – 2019: Bác sĩ tại Trung tâm Nội tiết tỉnh Quảng Ngãi",
      "2019 – nay: Chuyên gia tư vấn di truyền tại công ty TNHH Gene Friend Việt Nam",
    ],
    education: [
      "Tốt nghiệp Bác sĩ khóa 2007-2013 tại Đại học Y Dược Huế",
      "Tốt nghiệp Bác sỹ định hướng chuyên khoa Nội tiết (12/2013 – 7/2014) tại Bệnh viện Nội tiết Trung ương",
      "Chứng chỉ Sư phạm Y học cơ bản (2014) do CERETAD-HEALTH cấp",
      "Chứng chỉ Dinh dưỡng lâm sàng cơ bản và Dinh dưỡng điều trị bệnh mãn tính (2015) tại Trung tâm Dinh dưỡng TPHCM",
    ],
    expertise: [
      "Nội Tiết – Đái Tháo Đường",
      "Siêu Âm khám – chữa bệnh",
      "Tư vấn Tiền Đái Tháo Đường",
      "Tư vấn di truyền về nguy cơ sức khỏe và lối sống",
    ],
    research: [
      "Tìm hiểu kiến thức, thái độ, thực hành đối với việc sử dụng hàn the của người sản xuất, chế biến và sử dụng thực phẩm ở xã Hương Vinh, thị xã Hương Trà, Thừa Thiên Huế năm 2012.",
      "Nghiên cứu nồng độ iốt trong nước tiểu và một số yếu tố liên quan ở phụ nữ từ 18 đến 49 tuổi tại tỉnh Quảng Ngãi năm 2016.",
      "Nghiên cứu tỷ lệ rối loạn trầm cảm và một số yếu tố liên quan ở bệnh nhân đái tháo đường týp 2 đang điều trị ngoại trú tại Trung tâm Nội tiết tỉnh Quảng Ngãi năm 2017.",
    ],
    order: 1,
  },
  {
    name: "Lữ Phúc Phi",
    title: "BS.CKI",
    specialty: "Khoa Xét Nghiệm",
    image: "2.png",
    bio: "Trưởng khoa Xét nghiệm tại BV Đa khoa Khu vực Thủ Đức. Bác sĩ tại Phòng khám Nội Tổng Hợp BS. Lữ Phúc Phi.",
    positions: [
      "Trưởng khoa Xét nghiệm tại Bệnh viện Đa khoa Khu vực Thủ Đức",
      "Bác sỹ tại Phòng khám Nội Tổng Hợp BS. Lữ Phúc Phi",
    ],
    workplaces: [
      "Khoa Xét nghiệm, Bệnh viện Đa khoa Khu vực Thủ Đức",
      "Phòng khám Nội Tổng Hợp BS. Lữ Phúc Phi – Số 1 đường 29, Khu phố 2, Phường Linh Đông, Quận Thủ Đức, Hồ Chí Minh",
    ],
    expertise: [
      "Sơ cứu, khám bệnh, chữa bệnh đối với các bệnh nội khoa thông thường",
      "Thực hiện kỹ thuật điện tim, điện não đồ, điện cơ, lưu huyết não, siêu âm, nội soi tiêu hóa",
      "Thực hiện việc chăm sóc sức khỏe và khám bệnh, chữa bệnh tại nhà người bệnh",
    ],
    order: 2,
  },
  {
    name: "Trần Thị Kim Thu",
    title: "ThS.BS",
    specialty: "Nội Tổng quát & Hô hấp",
    image: "3.png",
    bio: "Tổng giám đốc Trung Tâm CHAC. Bác sĩ chuyên khoa Nội tổng quát & Hô hấp tại CHAC.",
    positions: [
      "Tổng giám đốc Trung Tâm CHAC",
      "Bác sỹ chuyên khoa Nội tổng quát & Hô hấp tại CHAC",
      "Bác sỹ điều trị tại Bệnh viện ĐH Y Dược TP.HCM",
    ],
    experience: [
      "Phòng khám Thăm dò chức năng hô hấp – BV ĐH Y Dược TP.HCM",
      "Khoa Hô hấp – BV ĐH Y Dược TP.HCM",
      "Phòng khám chuyên khoa Phổi",
      "Trung tâm Chăm sóc sức khoẻ cộng đồng (CHAC)",
      "Phòng khám Đa khoa Chac 2",
      "Hội viên Hội Hen - Miễn dịch Dị ứng Lâm sàng TPHCM",
      "Hội viên Hội Hô hấp TP HCM",
    ],
    expertise: [
      "Khám chuyên khoa Thăm dò chức năng hô hấp",
      "Nội tổng quát",
      "Hô hấp – Phổi",
    ],
    order: 3,
  },
  {
    name: "Ngô Thế Phi",
    title: "BS.CKII",
    specialty: "Khoa Nội Tiết",
    image: "4.png",
    bio: "Trưởng khoa Nội tiết Bệnh viện Quận Thủ Đức. Chuyên khám, tư vấn, điều trị và quản lý bệnh tiểu đường.",
    positions: [
      "Trưởng khoa Nội tiết – Bệnh viện Quận Thủ Đức",
      "Bác sĩ tại phòng khám Tiểu đường Ngô Thế Phi",
    ],
    education: [
      "1999: Tốt nghiệp Đại học Y dược TP.HCM",
      "2001: Hoàn thành chuyên khoa sơ bộ Nội tiết – Bệnh viện Chợ Rẫy",
      "2007: Tốt nghiệp chuyên khoa 1 Nội tiết – Đại học Y dược TP.HCM",
      "2013: Tốt nghiệp chuyên khoa 2 Nội tiết – Đại học Y dược TP.HCM",
    ],
    workplaces: [
      "Khoa Nội Tiết, Bệnh viện Thủ Đức",
      "Phòng khám tiểu đường BS Ngô Thế Phi – 241 Đặng Văn Bi, Phường Trường Thọ, TP Thủ Đức, TP Hồ Chí Minh",
    ],
    expertise: [
      "Khám, tư vấn, điều trị và quản lý bệnh tiểu đường",
    ],
    order: 4,
  },
];

const seed = async () => {
  await connectDB();
  await doctorModel.deleteMany({});
  await doctorModel.insertMany(doctors);
  console.log("✅ Seeded", doctors.length, "doctors");
  process.exit(0);
};

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});

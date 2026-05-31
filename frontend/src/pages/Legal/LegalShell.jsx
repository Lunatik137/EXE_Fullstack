import { useContext, useEffect } from "react";
import { Link, NavLink } from "react-router-dom";
import { StoreContext } from "../../context/StoreContext";
import "./LegalPages.css";

const LEGAL_CONTENT = {
  terms: {
    title: "Điều khoản dịch vụ",
    intro: "Các điều khoản này quy định quyền, nghĩa vụ và phạm vi trách nhiệm khi bạn truy cập hoặc sử dụng dịch vụ GreenPath.",
    sections: [
      {
        heading: "1. Chấp nhận điều khoản",
        paragraphs: [
          "Khi đăng ký tài khoản, truy cập website hoặc sử dụng ứng dụng GreenPath, bạn xác nhận đã đọc, hiểu và đồng ý bị ràng buộc bởi Điều khoản dịch vụ này.",
          "Nếu bạn không đồng ý với bất kỳ nội dung nào, vui lòng ngừng sử dụng dịch vụ."
        ]
      },
      {
        heading: "2. Mô tả dịch vụ",
        paragraphs: [
          "GreenPath cung cấp công cụ hỗ trợ xây dựng thực đơn, theo dõi dinh dưỡng, đặt món và quản lý lối sống lành mạnh. Nội dung trên nền tảng mang tính tham khảo.",
          "GreenPath không cung cấp chẩn đoán y khoa và không thay thế tư vấn từ bác sĩ, chuyên gia dinh dưỡng hoặc cơ sở y tế đủ thẩm quyền."
        ]
      },
      {
        heading: "3. Tài khoản người dùng",
        list: [
          "Bạn phải cung cấp thông tin chính xác, đầy đủ và cập nhật trong quá trình đăng ký.",
          "Bạn chịu trách nhiệm bảo mật thông tin đăng nhập và mọi hoạt động phát sinh từ tài khoản của mình.",
          "Bạn cần thông báo ngay cho GreenPath khi phát hiện truy cập trái phép hoặc rủi ro bảo mật tài khoản."
        ]
      },
      {
        heading: "4. Hành vi bị cấm",
        list: [
          "Sử dụng dịch vụ để vi phạm pháp luật, lừa đảo hoặc xâm phạm quyền lợi của bên thứ ba.",
          "Can thiệp trái phép vào hệ thống, phát tán mã độc hoặc thực hiện hành vi gây gián đoạn dịch vụ.",
          "Thu thập, sao chép hoặc khai thác dữ liệu từ nền tảng khi chưa có sự chấp thuận hợp pháp."
        ]
      },
      {
        heading: "5. Thanh toán và giao dịch",
        paragraphs: [
          "Một số tính năng hoặc đơn hàng có thể yêu cầu thanh toán thông qua cổng thanh toán liên kết. Bạn có trách nhiệm kiểm tra thông tin giao dịch trước khi xác nhận.",
          "Chính sách hoàn tiền, hủy đơn hoặc điều chỉnh giao dịch (nếu có) được áp dụng theo quy định hiển thị tại thời điểm thanh toán."
        ]
      },
      {
        heading: "6. Quyền sở hữu trí tuệ",
        paragraphs: [
          "Nội dung, thương hiệu, biểu tượng, thiết kế giao diện và dữ liệu do GreenPath phát triển thuộc quyền sở hữu hợp pháp của GreenPath hoặc bên cấp phép.",
          "Bạn không được sao chép, phân phối, sửa đổi hoặc khai thác thương mại khi chưa có chấp thuận bằng văn bản."
        ]
      },
      {
        heading: "7. Giới hạn trách nhiệm",
        paragraphs: [
          "Trong phạm vi pháp luật cho phép, GreenPath không chịu trách nhiệm đối với thiệt hại gián tiếp, ngẫu nhiên hoặc hệ quả phát sinh từ việc sử dụng hoặc không thể sử dụng dịch vụ.",
          "Bạn tự đánh giá mức độ phù hợp của thông tin dinh dưỡng với tình trạng sức khỏe cá nhân trước khi áp dụng."
        ]
      },
      {
        heading: "8. Tạm ngưng hoặc chấm dứt dịch vụ",
        paragraphs: [
          "GreenPath có quyền tạm ngưng, giới hạn hoặc chấm dứt quyền truy cập nếu phát hiện hành vi vi phạm điều khoản, gian lận hoặc gây rủi ro an toàn hệ thống."
        ]
      },
      {
        heading: "9. Thay đổi điều khoản",
        paragraphs: [
          "GreenPath có thể cập nhật Điều khoản dịch vụ theo từng thời kỳ để phù hợp vận hành thực tế và quy định pháp luật hiện hành.",
          "Phiên bản cập nhật sẽ được công bố trên nền tảng và có hiệu lực kể từ thời điểm đăng tải, trừ khi có thông báo khác."
        ]
      },
      {
        heading: "10. Luật áp dụng và liên hệ",
        paragraphs: [
          "Điều khoản này được điều chỉnh theo pháp luật Việt Nam. Mọi tranh chấp sẽ được ưu tiên giải quyết thông qua thương lượng; nếu không thành, tranh chấp có thể được đưa ra cơ quan có thẩm quyền.",
          "Email hỗ trợ pháp lý và dịch vụ: support@GreenPath.vn."
        ]
      }
    ]
  },
  privacy: {
    title: "Chính sách bảo mật",
    intro: "GreenPath cam kết tôn trọng và bảo vệ dữ liệu cá nhân của người dùng theo nguyên tắc minh bạch, an toàn và đúng mục đích.",
    sections: [
      {
        heading: "1. Phạm vi và mục đích",
        paragraphs: [
          "Chính sách này mô tả cách GreenPath thu thập, sử dụng, lưu trữ, chia sẻ và bảo vệ dữ liệu cá nhân khi bạn sử dụng website, ứng dụng và dịch vụ liên quan.",
          "Mục tiêu chính là cung cấp dịch vụ ổn định, cá nhân hóa trải nghiệm và tuân thủ yêu cầu pháp lý hiện hành."
        ]
      },
      {
        heading: "2. Loại dữ liệu được thu thập",
        list: [
          "Thông tin định danh và liên hệ: họ tên, email, số điện thoại, thông tin tài khoản.",
          "Thông tin hồ sơ sử dụng: mục tiêu dinh dưỡng, sở thích ăn uống, dữ liệu theo dõi thói quen.",
          "Dữ liệu kỹ thuật: thiết bị, địa chỉ IP, nhật ký truy cập, cookie và dữ liệu tương tác trong ứng dụng.",
          "Dữ liệu giao dịch: thông tin đơn hàng, trạng thái thanh toán và lịch sử sử dụng tính năng có phí (nếu có)."
        ]
      },
      {
        heading: "3. Cơ sở và mục đích xử lý dữ liệu",
        list: [
          "Thực hiện hợp đồng dịch vụ với người dùng.",
          "Nâng cao chất lượng sản phẩm, bảo trì hệ thống và hỗ trợ kỹ thuật.",
          "Gửi thông báo vận hành, bảo mật và cập nhật chính sách.",
          "Đáp ứng yêu cầu pháp lý hoặc yêu cầu từ cơ quan nhà nước có thẩm quyền."
        ]
      },
      {
        heading: "4. Chia sẻ dữ liệu cho bên thứ ba",
        paragraphs: [
          "GreenPath chỉ chia sẻ dữ liệu trong phạm vi cần thiết với đối tác cung cấp dịch vụ như thanh toán, lưu trữ hạ tầng, phân tích vận hành hoặc chăm sóc khách hàng.",
          "Các bên nhận dữ liệu phải tuân thủ nghĩa vụ bảo mật và chỉ xử lý dữ liệu theo chỉ đạo hợp pháp của GreenPath."
        ]
      },
      {
        heading: "5. Lưu trữ và bảo mật",
        paragraphs: [
          "Dữ liệu được lưu trữ trong thời gian cần thiết cho mục đích cung cấp dịch vụ, xử lý tranh chấp hoặc tuân thủ nghĩa vụ pháp lý.",
          "GreenPath áp dụng các biện pháp bảo mật phù hợp như kiểm soát truy cập, mã hóa, giám sát hệ thống và phân quyền nội bộ để giảm thiểu rủi ro truy cập trái phép."
        ]
      },
      {
        heading: "6. Cookie và công nghệ theo dõi",
        paragraphs: [
          "GreenPath sử dụng cookie và công nghệ tương tự để duy trì phiên đăng nhập, ghi nhớ tùy chọn và đo lường hiệu quả sử dụng dịch vụ.",
          "Bạn có thể điều chỉnh cài đặt cookie trên trình duyệt, tuy nhiên một số chức năng có thể bị ảnh hưởng."
        ]
      },
      {
        heading: "7. Quyền của người dùng",
        list: [
          "Yêu cầu truy cập và nhận bản sao dữ liệu cá nhân của bạn.",
          "Yêu cầu chỉnh sửa thông tin không chính xác hoặc không đầy đủ.",
          "Yêu cầu xóa hoặc hạn chế xử lý dữ liệu trong các trường hợp phù hợp pháp luật.",
          "Rút lại sự đồng ý đối với các hoạt động xử lý dựa trên sự đồng ý trước đó."
        ]
      },
      {
        heading: "8. Dữ liệu trẻ em",
        paragraphs: [
          "GreenPath không chủ đích thu thập dữ liệu từ trẻ em trái với quy định pháp luật. Nếu phát hiện dữ liệu được cung cấp không phù hợp, chúng tôi sẽ thực hiện biện pháp xử lý theo quy định."
        ]
      },
      {
        heading: "9. Cập nhật chính sách",
        paragraphs: [
          "Chính sách bảo mật có thể được cập nhật để phản ánh thay đổi về dịch vụ hoặc quy định pháp luật. Phiên bản mới nhất luôn được công bố trên nền tảng.",
          "Ngày hiệu lực: 07/05/2026."
        ]
      },
      {
        heading: "10. Liên hệ về quyền riêng tư",
        paragraphs: [
          "Nếu bạn có câu hỏi hoặc yêu cầu liên quan đến dữ liệu cá nhân, vui lòng liên hệ: support@GreenPath.vn hoặc hotline 1900 6868."
        ]
      }
    ]
  },
  contact: {
    title: "Liên hệ",
    intro: "GreenPath luôn sẵn sàng hỗ trợ bạn trong quá trình sử dụng dịch vụ.",
    sections: [
      {
        heading: "Thông tin hỗ trợ",
        list: [
          "Email: support@GreenPath.vn",
          "Hotline: 1900 6868",
          "Thời gian hỗ trợ: 08:00 - 21:00 (Thứ 2 - Chủ nhật)"
        ]
      },
      {
        heading: "Hợp tác và phản hồi",
        paragraphs: [
          "Nếu bạn muốn hợp tác nội dung, tích hợp dịch vụ hoặc góp ý để cải thiện sản phẩm, hãy gửi email cho chúng tôi. GreenPath trân trọng mọi phản hồi từ cộng đồng."
        ]
      }
    ]
  }
};

const LegalShell = ({ activeTab }) => {
  const { setShowLogin } = useContext(StoreContext);
  const content = LEGAL_CONTENT[activeTab] || LEGAL_CONTENT.terms;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeTab]);

  const handleSignUp = () => {
    setShowLogin({ show: true, mode: "signup" });
  };

  const handleLogin = () => {
    setShowLogin({ show: true, mode: "login" });
  };

  return (
    <div className="legal-page">
      <header className="legal-header">
        <div className="container legal-header-container">
          <Link to="/" className="legal-logo-link legal-logo-section" aria-label="Về trang chủ GreenPath">
            <div className="legal-logo-icon"><img src="/logo.png" alt="GreenPath" /></div>
            <h2 className="legal-logo-text">GreenPath</h2>
          </Link>
          <div className="legal-header-buttons">
            <button className="legal-login-btn" onClick={handleLogin}>
              Đăng nhập
            </button>
            <button className="legal-signup-btn" onClick={handleSignUp}>
              Đăng ký
            </button>
          </div>
        </div>
      </header>

      <main className="container legal-main">
        <aside className="legal-filter-col">
          <p className="legal-filter-title">Thông tin chung</p>
          <nav className="legal-filter-nav" aria-label="Bộ lọc nội dung pháp lý">
            <NavLink to="/terms" className={({ isActive }) => `legal-filter-link${isActive ? " active" : ""}`}>
              Điều khoản dịch vụ
            </NavLink>
            <NavLink to="/privacy" className={({ isActive }) => `legal-filter-link${isActive ? " active" : ""}`}>
              Chính sách bảo mật
            </NavLink>
            <NavLink to="/contact" className={({ isActive }) => `legal-filter-link${isActive ? " active" : ""}`}>
              Liên hệ
            </NavLink>
          </nav>
        </aside>

        <section className="legal-content-col" aria-live="polite">
          <h1>{content.title}</h1>
          <p className="legal-intro">{content.intro}</p>

          <div className="legal-content">
            {content.sections.map((section) => (
              <section key={section.heading}>
                <h2>{section.heading}</h2>
                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {section.list?.length ? (
                  <ul>
                    {section.list.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

export default LegalShell;

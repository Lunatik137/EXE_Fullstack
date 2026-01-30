import { useContext, useState } from 'react';
import './Header.css';
import { StoreContext } from "../../context/StoreContext";
import { toast } from "react-toastify";
import { assets } from '../../assets/frontend_assets/assets';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';

const Header = ({ setShowLogin }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const { token, setToken } = useContext(StoreContext);
  const navigate = useNavigate();
  
  const logout=()=>{
      localStorage.removeItem("token");
      setToken("");
      toast.success("Logout Successfully")
      navigate("/");
    }

  return (
    <div className="header"> 
      <div className="search-container">
        <span className="search-icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-search" viewBox="0 0 16 16">
  <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0"/>
</svg></span>
        <input 
          type="text" 
          placeholder="Tìm kiếm công thức, nguyên liệu..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
      </div>

      <div className="user-section">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="notification-icon" viewBox="0 0 16 16">
  <path d="M8 16a2 2 0 0 0 2-2H6a2 2 0 0 0 2 2M8 1.918l-.797.161A4 4 0 0 0 4 6c0 .628-.134 2.197-.459 3.742-.16.767-.376 1.566-.663 2.258h10.244c-.287-.692-.502-1.49-.663-2.258C12.134 8.197 12 6.628 12 6a4 4 0 0 0-3.203-3.92zM14.22 12c.223.447.481.801.78 1H1c.299-.199.557-.553.78-1C2.68 10.2 3 6.88 3 6c0-2.42 1.72-4.44 4.005-4.901a1 1 0 1 1 1.99 0A5 5 0 0 1 13 6c0 .88.32 4.2 1.22 6"/>
</svg>
        {!token ? (
                  <button onClick={() => setShowLogin(true)}>sign in</button>
                ) : (
                  <div className="navbar-profile">
                    <img src={assets.profile_icon} alt="" />
                    <ul className="nav-profile-dropdown">
                      <li onClick={()=>navigate("/myprofile")}><img src={assets.bag_icon} alt="" /><p>My Profile</p></li>
                      <hr />
                      <li onClick={logout}><img src={assets.logout_icon} alt="" /><p>Logout</p></li>
                    </ul>
                  </div>
                )}
      </div>
    </div>
  );
};

Header.propTypes = {
  setShowLogin: PropTypes.func.isRequired
};

export default Header;

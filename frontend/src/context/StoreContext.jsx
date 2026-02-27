import axios from "axios";
import { createContext, useEffect, useState } from "react";
import { toast } from "react-toastify";
import PropTypes from "prop-types";

export const StoreContext = createContext(null);

const StoreContextProvider = (props) => {
  const [cartItems, setCartItems] = useState({});
  const url = "http://localhost:4000";
  const [token, setToken] = useState("");
  const [food_list, setFoodList] = useState([]);
  const [showLogin, setShowLogin] = useState({ show: false, mode: 'login' });
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(true);
  const [userData, setUserData] = useState(null);

  const addToCart = async (itemId) => {
    if (!cartItems[itemId]) {
      setCartItems((prev) => ({ ...prev, [itemId]: 1 }));
    } else {
      setCartItems((prev) => ({ ...prev, [itemId]: prev[itemId] + 1 }));
    }
    if (token) {
      const response=await axios.post(
        url + "/api/cart/add",
        { itemId },
        { headers: { token } }
      );
      if(response.data.success){
        toast.success("item Added to Cart")
      }else{
        toast.error("Something went wrong")
      }
    }
  };

  const removeFromCart = async (itemId) => {
    setCartItems((prev) => ({ ...prev, [itemId]: prev[itemId] - 1 }));
    if (token) {
      const response= await axios.post(
        url + "/api/cart/remove",
        { itemId },
        { headers: { token } }
      );
      if(response.data.success){
        toast.success("item Removed from Cart")
      }else{
        toast.error("Something went wrong")
      }
    }
  };

  const getTotalCartAmount = () => {
    let totalAmount = 0;
    for (const item in cartItems) {
      if (cartItems[item] > 0) {
        let itemInfo = food_list.find((product) => product._id === item);
        totalAmount += itemInfo.price * cartItems[item];
      }
    }
    return totalAmount;
  };

  const fetchFoodList = async () => {
    const response = await axios.get(url + "/api/food/list");
    if (response.data.success) {
      setFoodList(response.data.data);
    } else {
      alert("Error! Products are not fetching..");
    }
  };

  const loadCartData = async (token) => {
    const response = await axios.post(
      url + "/api/cart/get",
      {},
      { headers: { token } }
    );
    setCartItems(response.data.cartData);
  };

  const loadUserData = async (token) => {
    try {
      const response = await axios.post(
        url + "/api/user/profile",
        {},
        { headers: { token } }
      );
      if (response.data.success) {
        setUserData(response.data.user);
      }
    } catch (error) {
      console.error("Error loading user data:", error);
    }
  };

  useEffect(() => {
    async function loadData() {
      await fetchFoodList();
      if (localStorage.getItem("token")) {
        const token = localStorage.getItem("token");
        setToken(token);
        await loadCartData(token);
        await loadUserData(token);
        // Load onboarding status from localStorage
        const onboardingStatus = localStorage.getItem("hasCompletedOnboarding");
        setHasCompletedOnboarding(onboardingStatus === "true");
      }
    }
    loadData();
  }, []);

  const contextValue = {
    food_list,
    cartItems,
    setCartItems,
    addToCart,
    removeFromCart,
    getTotalCartAmount,
    url,
    token,
    setToken,
    showLogin,
    setShowLogin,
    hasCompletedOnboarding,
    setHasCompletedOnboarding,
    userData,
    setUserData,
  };
  return (
    <StoreContext.Provider value={contextValue}>
      {props.children}
    </StoreContext.Provider>
  );
};

StoreContextProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export default StoreContextProvider;

import axios from "axios";

const API_URL =
  import.meta.env.VITE_API_URL ||
  `${window.location.protocol}//${window.location.hostname}:4000`;

const getHeaders = () => ({
  token: localStorage.getItem("adminToken") || localStorage.getItem("token"),
});

const adminAPI = {
  // Dashboard
  getStats: () =>
    axios.get(`${API_URL}/api/admin/stats`, { headers: getHeaders() }),

  // Users
  getUsers: (params) =>
    axios.get(`${API_URL}/api/admin/users`, { headers: getHeaders(), params }),
  getUserDetail: (id) =>
    axios.get(`${API_URL}/api/admin/users/${id}`, { headers: getHeaders() }),
  updateUserRole: (id, role) =>
    axios.patch(`${API_URL}/api/admin/users/${id}/role`, { role }, { headers: getHeaders() }),
  updateUserPlan: (id, data) =>
    axios.patch(`${API_URL}/api/admin/users/${id}/plan`, data, { headers: getHeaders() }),
  deleteUser: (id) =>
    axios.delete(`${API_URL}/api/admin/users/${id}`, { headers: getHeaders() }),

  // Foods
  getFoods: (params) =>
    axios.get(`${API_URL}/api/admin/foods`, { headers: getHeaders(), params }),
  addFood: (formData) =>
    axios.post(`${API_URL}/api/admin/foods`, formData, { headers: getHeaders() }),
  updateFood: (id, formData) =>
    axios.put(`${API_URL}/api/admin/foods/${id}`, formData, { headers: getHeaders() }),
  deleteFood: (id) =>
    axios.delete(`${API_URL}/api/admin/foods/${id}`, { headers: getHeaders() }),

  // Orders
  getOrders: (params) =>
    axios.get(`${API_URL}/api/admin/orders`, { headers: getHeaders(), params }),
  updateOrderStatus: (id, status) =>
    axios.patch(`${API_URL}/api/admin/orders/${id}/status`, { status }, { headers: getHeaders() }),

  // Posts
  getPosts: (params) =>
    axios.get(`${API_URL}/api/admin/posts`, { headers: getHeaders(), params }),
  deletePost: (id) =>
    axios.delete(`${API_URL}/api/admin/posts/${id}`, { headers: getHeaders() }),

  // Recipes
  getRecipes: (params) =>
    axios.get(`${API_URL}/api/admin/recipes`, { headers: getHeaders(), params }),
  updateRecipe: (id, data) => {
    if (data instanceof FormData) {
      return axios.put(`${API_URL}/api/admin/recipes/${id}`, data, { headers: getHeaders() });
    }
    return axios.put(`${API_URL}/api/admin/recipes/${id}`, data, { headers: getHeaders() });
  },
  deleteRecipe: (id) =>
    axios.delete(`${API_URL}/api/admin/recipes/${id}`, { headers: getHeaders() }),

  // Doctors
  getDoctors: (params) =>
    axios.get(`${API_URL}/api/admin/doctors`, { headers: getHeaders(), params }),
  addDoctor: (formData) =>
    axios.post(`${API_URL}/api/admin/doctors`, formData, { headers: getHeaders() }),
  updateDoctor: (id, data) =>
    axios.put(`${API_URL}/api/admin/doctors/${id}`, data, { headers: getHeaders() }),
  deleteDoctor: (id) =>
    axios.delete(`${API_URL}/api/admin/doctors/${id}`, { headers: getHeaders() }),

  // Consultations
  getConsultations: (params) =>
    axios.get(`${API_URL}/api/admin/consultations`, { headers: getHeaders(), params }),

  // Vouchers
  getVouchers: () =>
    axios.get(`${API_URL}/api/admin/vouchers`, { headers: getHeaders() }),
  createVoucher: (data) =>
    axios.post(`${API_URL}/api/admin/vouchers`, data, { headers: getHeaders() }),
  toggleVoucher: (id) =>
    axios.patch(`${API_URL}/api/admin/vouchers/${id}/toggle`, {}, { headers: getHeaders() }),
  deleteVoucher: (id) =>
    axios.delete(`${API_URL}/api/admin/vouchers/${id}`, { headers: getHeaders() }),
};

export default adminAPI;

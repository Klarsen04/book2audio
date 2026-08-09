import axios from "axios";

/**
 * API client for the no-login session model. The session cookie is sent
 * automatically (withCredentials). There is no login page to redirect to — a
 * 401 simply means "no session yet", which callers handle locally.
 */
const api = axios.create({
  baseURL: "",
  withCredentials: true,
});

export default api;

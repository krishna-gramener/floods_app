// Google Earth Engine Authentication Module

// Replace with your actual client ID
const CLIENT_ID = "1038234555082-e0ie48v2qi6tb8e04oetkdstjqkksdfq.apps.googleusercontent.com";

export function authenticate(callback) {
  console.log("Starting Earth Engine authentication...");
  
  ee.data.authenticateViaOauth(
    CLIENT_ID,
    () => {
      console.log("Auth successful");
      ee.initialize(null, null, callback, (err) => {
        console.error("EE init error", err);
      });
    },
    (err) => console.error("Auth error", err),
    null,
    () => console.log("OAuth flow started")
  );
}

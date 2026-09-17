import mongoose from 'mongoose';
import dns from 'dns';

// Ensure IPv4 first DNS lookup order for Node 20+ environments
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    const errorMsg = '[MongoDB Error] MONGODB_URI is not defined in backend .env file.';
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[MongoDB] Connected to MongoDB Atlas (${conn.connection.host})`);
    return conn;
  } catch (error) {
    console.error(`\n====================================================`);
    console.error(`[MongoDB Error] Failed to connect to MongoDB Atlas`);
    console.error(`Error details: ${error.message}`);
    console.error(`\nPOSSIBLE CAUSES & FIXES:`);
    console.error(`1. IP Whitelist: Ensure your current IP address is whitelisted in MongoDB Atlas.`);
    console.error(`   (MongoDB Atlas -> Network Access -> Add IP Address -> 0.0.0.0/0 or Current IP)`);
    console.error(`2. Connection String: Verify MONGODB_URI in backend/.env has correct credentials.`);
    console.error(`====================================================\n`);
    throw error;
  }
};

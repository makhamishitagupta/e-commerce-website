import { processChatMessage } from '../services/aiChatService.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const handleChatMessage = asyncHandler(async (req, res) => {
  const { message, conversationHistory, cartItems, merchantId } = req.body;

  const reply = await processChatMessage({
    message: message || '',
    conversationHistory: conversationHistory || [],
    cartItems: cartItems || [],
    merchantId: merchantId || req.query?.merchantId || req.merchantId || null,
  });

  res.json(new ApiResponse(200, reply));
});

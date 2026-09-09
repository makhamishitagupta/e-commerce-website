import { processChatMessage } from '../services/aiChatService.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const handleChatMessage = asyncHandler(async (req, res) => {
  const { message, conversationHistory, cartItems } = req.body;

  const reply = await processChatMessage({
    message: message || '',
    conversationHistory: conversationHistory || [],
    cartItems: cartItems || [],
  });

  res.json(new ApiResponse(200, reply));
});

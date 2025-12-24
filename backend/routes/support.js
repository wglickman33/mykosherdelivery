const express = require('express');
const { body, validationResult } = require('express-validator');
const { SupportTicket, Profile, AdminNotification } = require('../models');
const logger = require('../utils/logger');
const { appEvents } = require('../utils/events');

const router = express.Router();

router.post('/tickets', [
  body('requester_email').isEmail(),
  body('subject').isString().isLength({ min: 1 }),
  body('message').isString().isLength({ min: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { requester_email, requester_name, subject, message } = req.body;

    // Find existing user by email (if they have an account)
    const user = await Profile.findOne({ where: { email: requester_email } });

    // Create support ticket with optional user association
    const ticketData = {
      subject,
      message,
      status: 'open',
      priority: 'medium'
    };

    // Only associate with user if they have an account
    if (user) {
      ticketData.userId = user.id;
    } else {
      // For guest tickets, store requester info in the message
      ticketData.message = `From: ${requester_name || 'Guest'} (${requester_email})\n\n${message}`;
      // userId will be null for guest tickets
    }

    const ticket = await SupportTicket.create(ticketData);

    // Create global admin notification
    try {
      const notif = await AdminNotification.create({
        type: 'ticket.created',
        title: 'New Support Ticket',
        message: subject,
        readBy: [], // Empty array means no admin has read it yet
        data: { kind: 'ticket', id: ticket.id }
      });
      try { 
        appEvents.emit('admin.notification.created', { 
          id: notif.id, 
          type: notif.type, 
          title: notif.title, 
          message: notif.message, 
          data: notif.data, 
          createdAt: notif.createdAt 
        }); 
      } catch (err) { 
        logger.warn('Emit admin notification error', err); 
      }
    } catch (err) { 
      logger.warn('Create global admin notification error', err); 
    }

    return res.status(201).json({ success: true, data: { id: ticket.id }, message: 'Ticket created' });
  } catch (error) {
    logger.error('Error creating support ticket:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to create ticket' });
  }
});

module.exports = router; 
module.exports = (sequelize, DataTypes) => {
  const EmailLog = sequelize.define('EmailLog', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    recipientEmail: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'recipient_email'
    },
    subject: {
      type: DataTypes.STRING,
      allowNull: false
    },
    templateName: {
      type: DataTypes.STRING,
      field: 'template_name'
    },
    status: {
      type: DataTypes.ENUM('sent', 'delivered', 'failed', 'bounced'),
      defaultValue: 'sent'
    },
    mailchimpMessageId: {
      type: DataTypes.STRING,
      field: 'mailchimp_message_id'
    },
    emailjsMessageId: {
      type: DataTypes.STRING,
      field: 'emailjs_message_id'
    },
    errorMessage: {
      type: DataTypes.TEXT,
      field: 'error_message'
    },
    createdAt: {
      type: DataTypes.DATE,
      field: 'created_at',
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'email_logs',
    timestamps: false,
    underscored: true,
    indexes: [
      {
        fields: ['recipient_email']
      },
      {
        fields: ['status']
      },
      {
        fields: ['template_name']
      },
      {
        fields: ['created_at']
      }
    ]
  });


  return EmailLog;
}; 

module.exports = {
  notify: function(level, message) {
    const timestamp = new Date().toISOString();
    const logMsg = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

    console.log(logMsg);

    // TODO: Integrar com Slack/Discord/Email
    if (level === 'error') {
      // Notificar erro crítico
    }
    if (level === 'warning') {
      // Notificar aviso
    }
  },

  alertOnIssue: function(issue) {
    const msg = `ALERTA: Problema detectado - ${issue.type} (severidade: ${issue.severity})`;
    this.notify('warning', msg);
  },

  reportDaily: function(data) {
    const msg = `RELATÓRIO DIÁRIO: Taxa atendimento ${data.answerRate}%, Compliance ${data.compliance}%`;
    this.notify('info', msg);
  }
};

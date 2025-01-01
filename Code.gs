/**
 * @OnlyCurrentDoc
 */

function onOpen(e) {
  DocumentApp.getUi().createAddonMenu()
      .addItem('Start', 'showSidebar')
      .addToUi();
}

function onInstall(e) {
  onOpen(e);
}

function showSidebar() {
  const ui = HtmlService.createHtmlOutputFromFile('sidebar')
      .setTitle('Text to Speech with AWS Polly');
  DocumentApp.getUi().showSidebar(ui);
}

function getSelectedText() {
  const selection = DocumentApp.getActiveDocument().getSelection();
  if (!selection) throw new Error('Please select some text.');
  return selection.getSelectedElements().map(element => element.getElement().asText().getText()).join('\n');
}

function filterText(text) {
  // Remove [PAUSE] comments
  return text.replace(/\[PAUSE\]/g, ''); 
}

function getAwsCredentials() {
  // This function will be called from the sidebar to get the AWS credentials
  // You'll need to implement a way to securely store and retrieve these
  // For example, you could use PropertiesService.getUserProperties()
  // to store the credentials per user.
  return {
    accessKeyId: 'YOUR_AWS_ACCESS_KEY_ID', 
    secretAccessKey: 'YOUR_AWS_SECRET_ACCESS_KEY',
    region: 'YOUR_AWS_REGION' // e.g., 'us-east-1'
  };
}

function generateSpeech(text, awsCredentials) {
  // Make an HTTP request to the AWS Polly API
  const url = `https://polly.${awsCredentials.region}.amazonaws.com/v1/speech`;
  const payload = {
    OutputFormat: 'mp3',
    Text: text,
    VoiceId: 'Joanna' // You can change the voice as needed
  };

  const options = {
    'method' : 'post',
    'contentType': 'application/json',
    'payload' : JSON.stringify(payload),
    'headers': {
      'Authorization': getAwsAuthHeader(awsCredentials, payload)
    }
  };

  const response = UrlFetchApp.fetch(url, options);
  return response.getBlob();
}

function getAwsAuthHeader(awsCredentials, payload) {
  // Calculate the AWS Signature Version 4 (complex, but necessary)
  // You can find libraries or code snippets to help with this
  // Here's a basic example (you'll likely need to adapt it):

  const currentDate = new Date();
  const amzDate = Utilities.formatDate(currentDate, 'GMT', "yyyyMMdd'T'HHmmss'Z'");
  const dateStamp = Utilities.formatDate(currentDate, 'GMT', 'yyyyMMdd');

  const service = 'polly';
  const algorithm = 'AWS4-HMAC-SHA256';
  const signedHeaders = 'content-type;host;x-amz-date';
  const canonicalRequest = `POST
/v1/speech

content-type:application/json
host:polly.${awsCredentials.region}.amazonaws.com
x-amz-date:${amzDate}

content-type;host;x-amz-date
${Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(payload))
}`;

  const credentialScope = `${dateStamp}/${awsCredentials.region}/${service}/aws4_request`;
  const canonicalHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, canonicalRequest);
  const stringToSign = `${algorithm}
${amzDate}
${credentialScope}
${canonicalHash}`;

  const signingKey = getSignatureKey(awsCredentials.secretAccessKey, dateStamp, awsCredentials.region, service);
  const signature = Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_SHA_256, stringToSign, signingKey);

  return `${algorithm} Credential=${awsCredentials.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

function getSignatureKey(key, dateStamp, regionName, serviceName) {
  const kDate = Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_SHA_256, dateStamp, 'AWS4' + key);
  const kRegion = Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_SHA_256, regionName, kDate);
  const kService = Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_SHA_256, serviceName, kRegion);
  const kSigning = Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_SHA_256, 'aws4_request', kService);
  return kSigning;
}

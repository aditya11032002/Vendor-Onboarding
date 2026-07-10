/**
 * Google Apps Script to forward Google Form responses to your Node.js backend.
 * 
 * SETUP INSTRUCTIONS:
 * 1. Open your Google Form in Google Forms.
 * 2. Click the three dots (More) menu in the top right corner and select "Script editor".
 * 3. Delete any code in the editor and paste this code.
 * 4. Change the `SERVER_URL` variable below to your actual backend server URL (e.g. ngrok URL during local testing).
 * 5. Save the project (click the disk icon or Ctrl+S).
 * 6. Set up a trigger:
 *    - Click on the clock icon (Triggers) on the left sidebar.
 *    - Click "+ Add Trigger" in the bottom right.
 *    - Choose which function to run: `onFormSubmit`
 *    - Choose which deployment should run: `Head`
 *    - Select event source: `From form`
 *    - Select event type: `On form submit`
 *    - Click Save. It will ask for permissions; click "Advanced" and "Go to Untitled project (unsafe)" to grant access.
 */

// Set this to your actual server endpoint
const SERVER_URL = "https://crowd-scruffy-albatross.ngrok-free.dev/api/webhook/google-form";

function onFormSubmit(e) {
  try {
    var formResponse = e.response;
    var itemResponses = formResponse.getItemResponses();
    var payload = {};

    // 1. Loop through all questions and collect responses
    for (var i = 0; i < itemResponses.length; i++) {
      var itemResponse = itemResponses[i];
      var questionTitle = itemResponse.getItem().getTitle();
      var responseValue = itemResponse.getResponse();
      var itemType = itemResponse.getItem().getType();

      payload[questionTitle] = responseValue;

      // Extract actual filenames and view URLs for file upload fields from Google Drive
      if (itemType.toString() === "FILE_UPLOAD" && responseValue) {
        var fileIds = Array.isArray(responseValue) ? responseValue : [responseValue];
        var filenames = [];
        for (var j = 0; j < fileIds.length; j++) {
          try {
            var file = DriveApp.getFileById(fileIds[j]);
            var fname = file.getName();
            filenames.push(fname);
            
            // Map file URLs based on name keywords
            var lowerFname = fname.toLowerCase();
            if (lowerFname.indexOf('pan') !== -1) {
              payload["panFileUrl"] = file.getUrl();
            } else if (lowerFname.indexOf('gst') !== -1) {
              payload["gstFileUrl"] = file.getUrl();
            }
          } catch (e) {
            filenames.push("file_upload_" + fileIds[j]);
          }
        }
        payload[questionTitle + "_filenames"] = filenames;
      }
    }

    // 2. Add metadata
    payload["submittedAt"] = formResponse.getTimestamp();
    payload["respondentEmail"] = formResponse.getRespondentEmail();
    payload["googleFormResponseId"] = formResponse.getId();

    // 3. Post to the Express backend webhook
    var options = {
      "method": "post",
      "contentType": "application/json",
      "payload": JSON.stringify(payload),
      "muteHttpExceptions": true
    };

    var response = UrlFetchApp.fetch(SERVER_URL, options);

    Logger.log("Status Code: " + response.getResponseCode());
    Logger.log("Response: " + response.getContentText());

  } catch (error) {
    Logger.log("Failed to process trigger: " + error.toString());
  }
}

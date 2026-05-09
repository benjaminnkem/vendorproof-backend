Now, for the kyc for businesses, we want to implement ai kyc verification

now two major things will be uploaded.

two for personal verification (kycSelfie and kycIdDocument - like NIN number)

and just one for business (cac or tin).

the verification confidence is what determines the business initial trust score

now we will be using queues to handle this.

add a queues folder with another folder (kyc) which will have three files kyc.queue.ts, kyc.worker.ts, kyc.events.ts

in the kyc.queue.ts, you define the queue, kyc.worker is where the worker is added and kyc.events is where the logs and everything are defined

anything as regarding types is in our @file:index.ts or @file:index.ts

the queue name is gotten from @file:index.ts

if you read the prisma.schema
you will see business kyc is there

upload the images added for each business kyc to cloudinary first before processing.

when a business kyc is approved, they kycStatus is set to approved, set the score too.
whenever a kyc is rejected, the reason must be clearly stated

there are 5 verification types
for the user personal verification, two should be created.

nin and SELFIE
for Selfie, we need to compare the image in their NIN and selfie.
├─ Detect face from NIN and Selfie, if face not detected, set kyc to rejected and add the reason
├─ Extract embeddings
├─ Compare vectors
└─ Return confidence score

FOR This, use face-api.js, tensorflow, canvas and sharp and use open cv for image preprocessing to make sure it is not a fake document that was uploaded
i have added the three faceapi models you need (ssd_mobilenetv1, face_landmark_68, face_recognition), let me know if you need others, the face recognition should be sophisticated please, very sophisticated, very very accurate, store the result in businessKyc for verification type selfie

if confidence score is greater than .4/1, store the score as the equivalent in %, and set the verification status to approved.

Now for verification 2, where verification type is NIN: Nin verification
we use OCR to pickup their nin number from the upload id document.

for the OCR, use tesseract.js with open cv and sharp for preprocessing
if you are not able to pick up the nin, set the kyc status to rejected.
if you are, use the interswitch mock service that we have to verify the nin number with their first name, in the returned data, use the summary.nin_check.fieldMatches of the first name and last name to calculate the confidence score to use, also check the nin.firstname and nin.lastname, if it is that they match the first and last name that the user submitted but they are interchanged, that can be about 80% confidence score.

for business verification, we have CAC and TIN number
if it is cac document that is uploaded, use ocr to extract the business name and rcNumber
check if the business name (slug) matches the one gotten from the cacdocument, that gives first confidence score (based on the match level), then the rcNumber/business name gotten from OCR should be used to call the interswitch service to verifiy the business details, check if the business is active in the cac.active, if the business is not active, reject the kyc, if yes, accept it and that gives your second confidence score for the cac, now find the average of the two confidence scores you have and use that to determine the eventual confidence score for that CAC kyc.

if it is tin number that is entered, use the tin to get the taxpayer number and if it has a cacRegNo, use that to perform the cac kyc verification, but if not, don't bother, just give them 100% confidence score for that kyc if summary.tin_check === "verified" but reject the kyc if it is unverified.

in the end, if all kyc status are approved, the business kyc status in the business model is changed to approve

also the average confidence score is calculated and used

now for code strucutre any utility you are doing should be in their separate utility file in /utils/, like face.ts, ocr.ts
if it is gneeraic, you can add it in /utils/index.ts

what are your plans to prevent fake document upload?

const fs = require("fs");
const { PdfReader } = require("pdfreader");

// hardcoded constants (this may change)
const IGNORE_FIELDS = {
  "Routing Numbers /": true,
  "Numéros d'acheminement": true,
  "Electronic Paper(MICR)": true,
  "Électronique Papier(MICR)": true,
  "Postal Address - Addresse postale": true,
  "SECTION I NUMERIC LIST / LISTE NUMÉRIQUE": true,
  "SECTION I NUMERIC LIST MEMBERS / LISTE NUMÉRIQUE DES MEMBRES": true,
};

const PAGE_NUMBER_POSITION = { X: 34.103, Y: 1.188 };

const ADDRESS_X_POS = { 8.156: true, 8.219: true };

const BANK_DETAILS_KEYS = ["institutionNumber", "MICR", "address"];

// get text array with more than two spaces
function  getTextArrayWithMoreThanTwoSpaces(str){
  return str.match(/\s\s{2}/g)
}

// get bank name and code array 
function getInstitutionNameCodeArray(str){
  return str.replace(/\s\s+/g, ";").split(";");
}

// create address object
function createAddressObject (addressText){
  const valueArr = addressText.split(",");
  const postalCodeText =  valueArr[valueArr.length - 1].trim().split(" ").length === 2 ? 
  `${valueArr[valueArr.length - 1].trim().split(" ")[1]}` :
  valueArr[valueArr.length - 1].trim().split(" ").length >= 3 ?
  `${valueArr[valueArr.length - 1].trim().split(" ")[1]
} ${valueArr[valueArr.length - 1].trim().split(" ")[2]}` : "";

  // return the address object
  return  {
    line1: valueArr[0],
    line2: valueArr.slice(1, valueArr.length - 2).join().trim(),
    city: valueArr[valueArr.length - 2].trim(),
    state: valueArr[valueArr.length - 1].trim().split(" ")[0].trim(),
    postalCode: postalCodeText,
  };
}

// ReadPdf Pages
function readPDFPages(fileName) {
  const reader = new PdfReader();

  // We're returning a Promise here, as the PDF reading
  // operation is asynchronous.
  return new Promise((resolve, reject) => {
    // Each item in this array represents a page in the PDF
    let institutionBranches = [{}];
    let institutionNameCodeArr = [];
    let itemYPos = null;
    let itemKeyIndex = 0;
    let addressTextValue = null;

    reader.parseFileItems("./inputfiles/" + fileName, (err, item) => {
      if (err)
        // If we've got a problem, eject!
        reject(err);
      else if (!item) {
        // If we're out of items, resolve with the data structure
        resolve(institutionBranches);
      } else if (item.page) {
        // If the parser's reached a new page, it's time to
        // work on the next page object in our pages array.
        //console.log("Page Number :- " + item.page);
      } else if (item.text) {
        // create institutions array and add array with institution's name
        const institutions = institutionBranches[institutionBranches.length - 1][institutionNameCodeArr[0]] || [];

        // check if row contains text with more than two spaces
        if (getTextArrayWithMoreThanTwoSpaces(item.text) && 
            getTextArrayWithMoreThanTwoSpaces(item.text).length > 2) {
          // check if prev institution Name and current institution name 
          if (institutionNameCodeArr[0] && 
            institutionNameCodeArr[0] !== getInstitutionNameCodeArray(item.text)[0]) {
            //if true add new institution Object
            institutionBranches.push({});
          }
          // if true then add bank name and code to array
          institutionNameCodeArr = getInstitutionNameCodeArray(item.text);
        } else {
          // ignore the text fields which are not needed
          if (IGNORE_FIELDS[item.text] || (PAGE_NUMBER_POSITION.X === item.x &&
              PAGE_NUMBER_POSITION.Y === item.y)) {
            // console.log("Ignored");
          } 
          // if y values are not same then create new institution branch details object 
          // and add to the institutions array
          else if (item.y !== itemYPos) {
            itemYPos = item.y;
            // check newline address and concatenate with previous object's address
            if(ADDRESS_X_POS[item.x]){
              institutions[institutions.length - 1][BANK_DETAILS_KEYS[BANK_DETAILS_KEYS.length - 1]] = 
                createAddressObject(`${addressTextValue} ${item.text}`);
            }else{
              //create new institution branch details object and add to the institutions array
              institutions.push({ bankName: institutionNameCodeArr[0] });
              itemKeyIndex = 0;
              institutions[institutions.length - 1][BANK_DETAILS_KEYS[itemKeyIndex++]] = item.text;
            }  
          } 
          // add other fields to institution details (row object) if Y values are same
          else {
            let itemTextValue = item.text;
            // create address object using address text
              if (itemKeyIndex === BANK_DETAILS_KEYS.indexOf('address')) {
                addressTextValue = itemTextValue;
                itemTextValue = createAddressObject(itemTextValue);
              }
              // assigning fields to the branch detail's object
              institutions[institutions.length - 1][BANK_DETAILS_KEYS[itemKeyIndex++]] = itemTextValue;
          }
          // add institution's branches details in institutionbranches array
          institutionBranches[institutionBranches.length - 1][institutionNameCodeArr[0]] = institutions;
        }
      }
    });
  });
}

// write to Json file
function writeToJson(data , fileName) {
  fs.writeFileSync("./outputfiles/"+fileName,JSON.stringify({ data }),
  "utf8", function (err) {
      if (err) {
        console.log("An error occured while writing JSON Object to File.");
        return console.log(err);
      }
      console.log("JSON file has been saved.");
    }
  );
}

// pass file names
readPDFPages("banks.pdf").then((data) => writeToJson(data,"banks.json"));
readPDFPages("creditunions.pdf").then((data) => writeToJson(data,"creditunions.json"));

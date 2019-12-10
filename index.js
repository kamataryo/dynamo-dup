#!/usr/bin/env node
const AWS = require("aws-sdk");

const {
  ORIGIN_REGION,
  DESTINATION_REGION,
  ORIGIN_TABLE_NAME,
  DESTINATION_TABLE_NAME
} = process.env;

const isWet = process.argv.includes("--wet-run");

const main = async () => {
  AWS.config.region = ORIGIN_REGION;
  const ddb1 = new AWS.DynamoDB();
  const docClient1 = new AWS.DynamoDB.DocumentClient();
  const opt1 = { TableName: ORIGIN_TABLE_NAME };

  const { Table: tableDef } = await ddb1.describeTable(opt1).promise();
  const { Items = [] } = await docClient1.scan(opt1).promise();

  const RequestItems = {
    [DESTINATION_TABLE_NAME]: Items.map(Item => ({ PutRequest: { Item } }))
  };
  console.log(JSON.stringify(RequestItems, null, 2));
  console.log(JSON.stringify(tableDef, null, 2));
  delete tableDef.ProvisionedThroughput.NumberOfDecreasesToday;

  if (isWet) {
    AWS.config.region = DESTINATION_REGION;
    const ddb = new AWS.DynamoDB();

    try {
      await ddb.describeTable({ TableName: DESTINATION_TABLE_NAME }).promise();
    } catch (err) {
      await ddb
        .createTable({
          TableName: DESTINATION_TABLE_NAME,
          AttributeDefinitions: tableDef.AttributeDefinitions,
          KeySchema: tableDef.KeySchema,
          ProvisionedThroughput: tableDef.ProvisionedThroughput
        })
        .promise();
    }

    const docClient2 = new AWS.DynamoDB.DocumentClient();
    await docClient2.batchWrite({ RequestItems }).promise();
  } else {
    process.stdout.write("If you ready, please specify `--wet-run` option.\n");
  }
};

main();

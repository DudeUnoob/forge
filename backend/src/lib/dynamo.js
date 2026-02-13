import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
    DynamoDBDocumentClient,
    GetCommand,
    PutCommand,
    QueryCommand,
    UpdateCommand,
    DeleteCommand,
} from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
});

export async function getItem(tableName, key) {
    const result = await docClient.send(new GetCommand({ TableName: tableName, Key: key }));
    return result.Item || null;
}

export async function putItem(tableName, item) {
    await docClient.send(new PutCommand({ TableName: tableName, Item: item }));
    return item;
}

export async function updateItem(tableName, key, updates) {
    const expressions = [];
    const names = {};
    const values = {};

    Object.entries(updates).forEach(([field, value], i) => {
        expressions.push(`#f${i} = :v${i}`);
        names[`#f${i}`] = field;
        values[`:v${i}`] = value;
    });

    await docClient.send(new UpdateCommand({
        TableName: tableName,
        Key: key,
        UpdateExpression: `SET ${expressions.join(', ')}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
    }));
}

export async function queryItems(tableName, keyCondition, expressionValues, options = {}) {
    const params = {
        TableName: tableName,
        KeyConditionExpression: keyCondition,
        ExpressionAttributeValues: expressionValues,
        ...options,
    };
    const result = await docClient.send(new QueryCommand(params));
    return result.Items || [];
}

export async function deleteItem(tableName, key) {
    await docClient.send(new DeleteCommand({ TableName: tableName, Key: key }));
}

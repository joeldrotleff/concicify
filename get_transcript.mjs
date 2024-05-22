import fs from "fs";
import OpenAI from "openai";
import { fileURLToPath } from "url";
import ffmpeg from 'fluent-ffmpeg';
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const openai = new OpenAI();

async function transcribe(audioInput) {
  console.log(audioInput);
  const transcription = await openai.audio.transcriptions.create({
    file: fs.createReadStream(audioInput),
    model: "whisper-1",
  });

  console.log("Transcription: ", transcription);

  return transcription;
}


async function convertVideoToAudio(input, output) {
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .output(output)
      .on('end', function() {
        console.log('conversion ended');
        resolve();
      }).on('error', function(e) {
        console.log('error: ', e.code, e.msg);
        reject(e);
      }).run();
  });
}

const modelId = 'anthropic.claude-3-sonnet-20240229-v1:0';
const anthropicVersion = 'bedrock-2023-05-31'

export const invokeModel = async (
  prompt,
  modelId = modelId,
) => {
  // Create a new Bedrock Runtime client instance.
  const client = new BedrockRuntimeClient({ region: "us-east-1" });

  // Prepare the payload for the model.
  const payload = {
    anthropic_version: anthropicVersion,
    max_tokens: 1000,
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: prompt }],
      },
    ],
  };

  // Invoke Claude with the payload and wait for the response.
  const command = new InvokeModelCommand({
    contentType: "application/json",
    body: JSON.stringify(payload),
    modelId,
  });
  const apiResponse = await client.send(command);

  // Decode and return the response(s)
  const decodedResponseBody = new TextDecoder().decode(apiResponse.body);
  /** @type {MessagesResponseBody} */
  const responseBody = JSON.parse(decodedResponseBody);
  return responseBody.content[0].text;
};



async function getUnnecessaryParts(transcript) {
  let prompt = fs.readFileSync("instructions_for_claude.txt", "utf8");
  prompt = prompt.replace("((REPLACE_ME_WITH_TRANSCRIPT))", transcript);
  const modelId = "anthropic.claude-3-sonnet-20240229-v1:0";
  // console.log(`Prompt: ${prompt}`);
  console.log(`Model ID: ${modelId}`);

  try {
    console.log("-".repeat(53));
    const response = await invokeModel(prompt, modelId);
    console.log("\n" + "-".repeat(53));
    console.log("Final structured response:");
    console.log(response);
  } catch (err) {
    console.log(`\n${err}`);
  }
}


// LETS GO!

try {
  const audioFile = 'input.mp3';
  await convertVideoToAudio('sample_video.mov', audioFile);
  console.log('Video converted to audio successfully');
  const transcript = await transcribe(audioFile);
  const transcriptText = transcript.text;
  console.log('actual Transcript:', transcriptText);
  const unnecessaryParts = await getUnnecessaryParts(transcriptText);
} catch (error) {
  console.error('Error converting video to audio:', error);
}




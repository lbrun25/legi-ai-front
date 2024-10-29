import {PubSub} from "@google-cloud/pubsub";

export const pubSubClient = new PubSub({
  keyFilename: 'keys/mike-pub-sub-key.json',
});

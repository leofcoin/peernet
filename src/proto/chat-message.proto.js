export default `
message ChatMessage {
  required string value = 1;
  required string author = 2;
  required uint64 timestamp = 3;
  repeated string files = 4;
}`

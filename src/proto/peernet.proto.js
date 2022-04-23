export default `
// PeernetMessage
message PeernetMessage {
  required bytes data = 1;
  required bytes signature = 2;
  optional string from = 3;
  optional string to = 4;
  optional string id = 5;
}`

export default `
// PeernetMessage
message PeernetMessage {
  required bytes data = 1;
  required bytes signature = 2;
  optional bytes from = 3;
  optional bytes to = 4;
  optional string id = 5;
}`

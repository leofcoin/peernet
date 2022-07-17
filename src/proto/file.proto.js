export default `
// PeernetFolder
message PeernetFileLink {
  required string hash = 1;
  required string path = 2;
  optional string size = 3;
}

message PeernetFile {
  required string path = 1;
  optional string content = 2;
  repeated PeernetFileLink links = 3;
}
`

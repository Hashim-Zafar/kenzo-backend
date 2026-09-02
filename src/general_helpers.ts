export const hashRawToken = async (rawToken: string) => {
  //encode the rawtoken
  const encoder = new TextEncoder();
  const data = encoder.encode(rawToken);

  //generate the hash to be stored in database
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashToken = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return hashToken;
};

export const generateHash = async () => {
  // allocate a memory for 32 bytes (array)
  const randomBytes = new Uint8Array(32);

  // fill the array with cryptographically secure numbers
  crypto.getRandomValues(randomBytes);

  //convert them to hexadecimal string
  const rawToken = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ");

  //encode the rawtoken
  const hashToken = await hashRawToken(rawToken);

  return { rawToken, hashToken };
};

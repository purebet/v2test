var solanaWeb3 = require("@solana/web3.js");
var splToken = require("@solana/spl-token");
var bs58 = require("bs58");

var connection = new solanaWeb3.Connection("https://staging-rpc.dev2.eclipsenetwork.xyz");
var signer = "keypair here to send the sol for tx fee and pool rent exemption";
var mint = new solanaWeb3.PublicKey("3zPjW4EMwJzd6yjriNk66X88aJqjgKcXWL8Cfb2Ydyfm");
var tokProg = new solanaWeb3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
var programID = new solanaWeb3.PublicKey("9uReBEtnYGYf1oUe4KGSt6kQhsqGE74i17NzRNEDLutn");

//find pda and bump
function genPdaAndBump(){
    let [pda, bump] = solanaWeb3.PublicKey.findProgramAddressSync([Buffer.from("pool")], programID);
    return {pda, bump};
}

// create ata for pda
async function init(){
    let {pda, bump} = genPdaAndBump();
    const seeds = [
        pda.toBuffer(),
        tokProg.toBuffer(),
        mint.toBuffer(),
    ];
    let tx = new solanaWeb3.Transaction();
    const [ataAddress] = await solanaWeb3.PublicKey.findProgramAddress(
        seeds, 
        splToken.ASSOCIATED_TOKEN_PROGRAM_ID
    );
    let createATA = splToken.createAssociatedTokenAccountInstruction(
        signer.publicKey,
        ataAddress,
        pda,
        mint
    );
    tx.add(createATA);
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    console.log(await connection.sendTransaction(tx, [signer]));
    console.log(pda.toBase58(), bump, ataAddress.toBase58());
    //8AbwG4Cbr9DefgeF7P9Pt9RJMA1RS1KVogRWBWh9U8wM 255 5Vb9i9jVsBjSfsRyR48wLMfAFmQpGpoZNDGTNYEaqWVA
}
init();

var solanaWeb3 = require("@solana/web3.js");
var connection = new solanaWeb3.Connection("https://api.devnet.solana.com");

async function readTx(){
    let result = await connection.getSignaturesForAddress(new solanaWeb3.PublicKey("9uReBEtnYGYf1oUe4KGSt6kQhsqGE74i17NzRNEDLutn"));
    for(let i = 0; i < result.length; i++){
        if(result[i].memo != null){
            /*
            let start = result[i].memo.indexOf("{");
            let info = JSON.parse(result[i].memo.substring(start));
            console.log(info);
            */
           console.log(result[i].memo);
        }
    }
}

readTx();

let d='';
process.stdin.on('data',c=>d+=c);
process.stdin.on('end',()=>{
  const j = JSON.parse(d);
  console.log('status:', j.status);
  console.log('has qr:', !!j.qr);
});

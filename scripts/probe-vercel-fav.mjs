const base = "https://apt-compare-beta.vercel.app";

const fav = [
  {
    lawdCd: "11140",
    guName: "중구",
    dong: "명동",
    apt: "전역Vercel테스트",
    area: "",
    notify: false
  }
];

const post = await fetch(`${base}/api/favorites`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ favorites: fav })
});
const postJson = await post.json();
console.log("POST", post.status, postJson?.store?.storage, postJson?.favorites?.length);

const get = await fetch(`${base}/api/favorites`);
const getJson = await get.json();
console.log("GET", get.status, getJson?.store?.storage, getJson?.favorites?.length);
if (getJson?.favorites?.[0]) console.log("apt", getJson.favorites[0].apt);

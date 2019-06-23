/*
*
*
*       Complete the API routing below
*
*
*/

'use strict';

const expect = require('chai').expect;
const MongoClient = require('mongodb');
const mongoose = require("mongoose");
const apiKey = process.env.API_KEY;
const axios = require('axios');
const Stock = require("../models/stocks");

const CONNECTION_STRING = process.env.DB; //MongoClient.connect(CONNECTION_STRING, function(err, db) {});
mongoose.connect(process.env.DB, { useNewUrlParser: true })

module.exports = function (app) {
  
  const oneStockGet = (stock) => {
    return new Promise((resolve, reject) => {
      axios.get(`https://cloud.iexapis.com/stable/stock/${stock}/quote?token=${apiKey}`).then(response => {
        console.log(response.data);
        resolve(response.data);
      }).catch(err => reject("no data"));
    })
  }
  
  const twoStockGet = (stock1, stock2) => {
    return new Promise((resolve, reject) => {
      axios.all([
      axios.get(`https://cloud.iexapis.com/stable/stock/${stock1}/quote?token=${apiKey}`),
      axios.get(`https://cloud.iexapis.com/stable/stock/${stock2}/quote?token=${apiKey}`)
      ])
      .then(axios.spread((stock1, stock2) => {
        resolve([stock1.data, stock2.data]);
      })).catch(err => reject("no data"));
    })
  }
  
  async function twoStockSaveUpdate(stock1, stock2, data, isLiked, ip) {
    // save or update first stock
    try {
      await Stock.findOne({name: stock1.toLowerCase()}).then(stock => {
        if(stock) {
          if(isLiked && !stock.ipAddresses.includes(ip)) {
            stock.ipAddresses.push(ip);
            stock.likes += 1;
            return stock.save();
          }
        } else {
          const name = data[0].symbol.toLowerCase();
          const likes = isLiked ? 1 : 0;
          const ipAddresses = likes > 0 ? [ip] : [];
          const newStock = new Stock({name, ipAddresses, likes});
          return newStock.save();
        }
      })
    } catch(err) { console.log(err) }
//           save or update second stock
    try {
      await Stock.findOne({name: stock2.toLowerCase()}).then(stock => {
        if(stock) {
          if(isLiked && !stock.ipAddresses.includes(ip)) {
            stock.ipAddresses.push(ip);
            stock.likes += 1;
            return stock.save();
          }
        } else {
          const name = data[1].symbol.toLowerCase();
          const likes = isLiked ? 1 : 0;
          const ipAddresses = likes > 0 ? [ip] : [];
          const newStock = new Stock({name, ipAddresses, likes});
          return newStock.save();
        }
      })
    } catch(err) { console.log(err) }
  }
  
  app.route('/api/stock-prices')
    .get((req, res) => {
      const ip = req.headers['x-forwarded-for'].split(',')[0] || req.connection.remoteAddress;
      if(!Array.isArray(req.query.stock)) {
        oneStockGet(req.query.stock).then(data => {
          Stock.findOne({name: data.symbol.toLowerCase()}).then(stock => {
            if(stock) {
              if(req.query.like && !stock.ipAddresses.includes(ip)) {
                stock.ipAddresses.push(ip);
                stock.likes += 1;
                stock.save().then(result => {
                  res.json({stockData: {stock: data.symbol, price: data.latestPrice, likes: result.likes}})
                })
              } else {
                res.json({stockData: {stock: data.symbol, price: data.latestPrice, likes: stock.likes}})
              }
            } else {
              const name = data.symbol.toLowerCase();
              const likes = req.query.like ? 1 : 0;
              const ipAddresses = likes > 0 ? [ip] : [];
              const newStock = new Stock({name, ipAddresses, likes});
              newStock.save().then(result => {
                res.json({stockData: {stock: data.symbol, price: data.latestPrice, likes: result.likes}})
              })
            }
          }).catch(err => console.log(err))
        }).catch(err => res.send("no data"));
      } 
    
      else {
        const {stock} = req.query;
        twoStockGet(stock[0], stock[1]).then(data => {
          console.log(data)
          if(data.length < 2) {
            return res.send("no data");
          }
          
          (async () => {
            
            await twoStockSaveUpdate(stock[0], stock[1], data, req.query.like, ip) 
          
            try {
              await Stock.find({"$or": [
                {name: stock[0]}, 
                {name: stock[1]}
              ]}).then(stocks => {
                return {
                  stockData: [
                    {stock: data[0].symbol, price: data[0].latestPrice, rel_likes: stocks[0].likes - stocks[1].likes},
                    {stock: data[1].symbol, price: data[1].latestPrice, rel_likes: stocks[1].likes - stocks[0].likes}
                  ]
                }
              }).then(result => {
                res.json(result);
              }).catch(err => console.log(err))
            } catch(err) { console.log(err) }
          })()
        }).catch(err => res.send("no data"))
      }
    });
    
};

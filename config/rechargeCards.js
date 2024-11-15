const crypto = require('crypto');

function generateUniqueCode() {
  return crypto.randomBytes(8).toString('hex');
}

function createRechargeCard(db, amount) {
  const code = generateUniqueCode();
  return new Promise((resolve, reject) => {
    db.query('INSERT INTO recharge_cards (code, amount) VALUES (?, ?)', [code, amount], (err) => {
      if (err) {
        console.error('Error creating recharge card:', err);
        reject(err);
      } else {
        resolve(code);
      }
    });
  });
}

function useRechargeCard(db, code, userId) {
  return new Promise((resolve, reject) => {
    db.beginTransaction((err) => {
      if (err) {
        reject(err);
        return;
      }

      db.query('SELECT * FROM recharge_cards WHERE code = ? AND is_used = 0', [code], (err, results) => {
        if (err || results.length === 0) {
          db.rollback(() => reject(err || new Error('Invalid or used code')));
          return;
        }

        const card = results[0];
        db.query('UPDATE recharge_cards SET is_used = 1 WHERE id = ?', [card.id], (err) => {
          if (err) {
            db.rollback(() => reject(err));
            return;
          }

          db.query('UPDATE users SET balance = balance + ? WHERE id = ?', [card.amount, userId], (err) => {
            if (err) {
              db.rollback(() => reject(err));
              return;
            }

            db.commit((err) => {
              if (err) {
                db.rollback(() => reject(err));
              } else {
                resolve(true);
              }
            });
          });
        });
      });
    });
  });
}

module.exports = { createRechargeCard, useRechargeCard };
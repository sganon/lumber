'use strict';

module.exports = (sequelize, DataTypes) => {
  var Model = sequelize.define('albums', {
    'Title': {
      type: DataTypes.STRING,
    },
    'ArtistId': {
      type: DataTypes.INTEGER,
    },
  }, {
    tableName: 'albums',
    
    timestamps: false,
    
  });

  Model.associate = (models) => {
  };

  return Model;
};


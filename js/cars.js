'use strict';

/**
 * 车型定义：造型、颜色、操控（越大越跟手）与体积（命中盒/车身缩放）。
 * handling 参考区间：11 迟钝 ~ 24 极灵；size：0.86 瘦 ~ 1.08 大。
 */

var CARS = [
  {
    id: 'sedan',
    name: '家常小红车',
    color: '#e53935',
    handling: 14,
    size: 1.0,
    style: 'sedan',
    desc: '均衡可靠，适合新手'
  },
  {
    id: 'sports',
    name: '黄色闪电',
    color: '#fdd835',
    handling: 20,
    size: 0.92,
    style: 'sports',
    desc: '转向极快，车身更瘦'
  },
  {
    id: 'suv',
    name: '蓝色大块头',
    color: '#42a5f5',
    handling: 11,
    size: 1.08,
    style: 'suv',
    desc: '车身巨大，考验走位'
  },
  {
    id: 'f1',
    name: '紫色方程式',
    color: '#7e57c2',
    handling: 24,
    size: 0.86,
    style: 'f1',
    desc: '极致灵活，车身最瘦'
  }
];

function find(id) {
  for (var i = 0; i < CARS.length; i++) {
    if (CARS[i].id === id) return CARS[i];
  }
  return CARS[0];
}

module.exports = {
  CARS: CARS,
  find: find
};

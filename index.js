'use strict';

const meta = require('./package.json');
const coveralls = require('coveralls');
const through2 = require('through2');

module.exports = {
  meta,
  config: {
    'report.coveralls': {
      default: false,
      as: 'report',
    },
  },
  get(gt) {
    const config = gt.getConfig();

    if (!config.report) {
      return gt.NO_TASK;
    }

    gt.on('done:report:coverage:istanbul', (event, next) => {
      function transformFunction(file, __, cb) {
        if (file.isNull()) {
          this.push(file);
          return cb();
        } else if (file.isStream()) {
          next(new Error('Stream content is not supported'));
          return cb();
        }

        coveralls.getBaseOptions((optionErr, someOptions) => {
          if (optionErr) {
            return next(optionErr);
          }

          return coveralls.convertLcovToCoveralls(
            file.contents.toString(),
            Object.assign({}, someOptions, { filepath: '.' }),
            (convertErr, postData) => {
              if (convertErr) {
                return next(convertErr);
              }

              return coveralls.sendToCoveralls(
                postData,
                (sendErr, response, body) => {
                  if (sendErr) {
                    return next(sendErr);
                  }

                  if (response.statusCode >= 400) {
                    return next(
                      new Error(
                        `Bad response: ${response.statusCode} - ${JSON.parse(body).message}`
                      )
                    );
                  }

                  return next();
                }
              );
            }
          );
        });

        return this.push(file);
      }

      gt.src('lcov.info', { cwd: event.path })
        .pipe(through2.obj(transformFunction));
    });

    return gt.NO_TASK;
  },
};

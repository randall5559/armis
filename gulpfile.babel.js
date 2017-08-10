import gulp from 'gulp';
import babel from 'gulp-babel';
import merge from 'merge-stream';

gulp.task('armis', function () {
    let streams = [];

    let appFile = gulp.src('src/index.js')
        .pipe(babel())
        .pipe(gulp.dest('./'));

    let assets = gulp.src('src/assets/*')
        .pipe(gulp.dest('./assets'));

    let dir = gulp.src('src/controllers/*')
        .pipe(babel())
        .pipe(gulp.dest('./controllers'));

    streams.push(dir);

    return merge(appFile, streams);
});

gulp.task('armis-cli', function () {
    let dirs = ['controllers', 'models', 'helpers', 'assets'];
    let streams = [];


    let appFile = gulp.src('bin/armis/src/index.js')
        .pipe(babel())
        .pipe(gulp.dest('bin/armis/dist'));

    dirs.map(function(path) {
        let dir = gulp.src('bin/armis/src/'+path+'/*')
            .pipe(babel())
            .pipe(gulp.dest('bin/armis/dist/'+path));

        streams.push(dir);
    });

    return merge(appFile, streams);
});
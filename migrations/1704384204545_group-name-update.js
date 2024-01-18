/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.sql(`ALTER TABLE idols DROP CONSTRAINT idols_group_name_fkey`);

    pgm.sql(`ALTER TABLE idols ADD CONSTRAINT idols_group_name_fkey 
            FOREIGN KEY (group_name) REFERENCES groups(name)
            ON UPDATE CASCADE;`);


    pgm.sql(`ALTER TABLE quiz_image_questions DROP CONSTRAINT quiz_image_questions_group_name_fkey`);

    pgm.sql(`ALTER TABLE quiz_image_questions ADD CONSTRAINT quiz_image_questions_group_name_fkey
            FOREIGN KEY (group_name) REFERENCES groups(name)
            ON UPDATE CASCADE;`);
};

exports.down = pgm => {
    pgm.sql(`ALTER TABLE idols DROP CONSTRAINT idols_group_name_fkey`);
    pgm.sql(`ALTER TABLE idols ADD CONSTRAINT idols_group_name_fkey 
            FOREIGN KEY (group_name) REFERENCES groups(name);`);

    pgm.sql(`ALTER TABLE quiz_image_questions DROP CONSTRAINT quiz_image_questions_group_name_fkey`);
    pgm.sql(`ALTER TABLE quiz_image_questions ADD CONSTRAINT quiz_image_questions_group_name_fkey
            FOREIGN KEY (group_name) REFERENCES groups(name);`);

};

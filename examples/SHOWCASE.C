#include <graphics.h>
#include <conio.h>
#include <stdio.h>

int main(void)
{
    int gd = DETECT, gm, err;

    initgraph(&gd, &gm, "C:\\TURBOC3\\BGI");
    err = graphresult();
    if (err != grOk) {
        printf("Graphics error: %s\n", grapherrormsg(err));
        getch();
        return 1;
    }

    setbkcolor(BLACK);
    setcolor(LIGHTCYAN);
    rectangle(90, 60, 550, 420);
    circle(320, 220, 110);
    line(210, 220, 430, 220);
    line(320, 110, 320, 330);

    setcolor(YELLOW);
    outtextxy(215, 370, "graphics.h / BGI works!");
    setcolor(LIGHTGREEN);
    outtextxy(230, 390, "Turbo C3 Web Lab");

    getch();
    closegraph();
    return 0;
}
